// 목업 통계: Riot API 키를 받기 전까지 쓰는 가짜 데이터.
// 같은 챔피언·라인·랭크 조합이면 항상 같은 값이 나오도록 시드 기반 난수를 씁니다.
// API 키가 생기면 이 파일의 함수들을 실제 집계 데이터로 교체하면 됩니다.
import type { Champion, Item, RuneTree, SummonerSpell } from "./ddragon";
import type { Lane, Rank } from "./lanes";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (r: () => number, min: number, max: number) => min + r() * (max - min);
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
function pickN<T>(r: () => number, arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
}

// 챔피언 태그로 주 라인을 추정 (실제 데이터가 생기면 픽률 기반으로 대체)
const TAG_LANES: Record<string, Lane[]> = {
  Marksman: ["bottom"],
  Support: ["support"],
  Mage: ["mid", "support"],
  Assassin: ["mid", "jungle"],
  Fighter: ["top", "jungle"],
  Tank: ["top", "support", "jungle"],
};

export function lanesFor(champ: Champion): Lane[] {
  const r = rng(`lanes:${champ.id}`);
  const main: Lane = champ.tags.includes("Marksman")
    ? "bottom"
    : champ.tags.includes("Support")
      ? "support"
      : (TAG_LANES[champ.tags[0]]?.[0] ?? "mid");
  const lanes = new Set<Lane>([main]);
  for (const l of champ.tags.flatMap((t) => TAG_LANES[t] ?? [])) if (r() < 0.35) lanes.add(l);
  return [...lanes];
}

export type Tier = "OP" | "1" | "2" | "3" | "4" | "5";

export type ChampionStat = {
  champion: Champion;
  lane: Lane;
  score: number;
  tier: Tier;
  winRate: number;
  pickRate: number;
  banRate: number;
  games: number;
  rankChange: number;
};

function baseStat(champ: Champion, lane: Lane, rank: Rank, patch: string) {
  const r = rng(`stat:${champ.id}:${lane}:${rank}:${patch}`);
  const isMain = lanesFor(champ)[0] === lane;
  const winRate = range(r, 46.5, 53.5);
  const pickRate = isMain ? range(r, 1, 14) : range(r, 0.5, 4);
  const banRate = r() < 0.7 ? range(r, 0.2, 6) : range(r, 6, 35);
  const sampleBase = rank === "master" ? 4000 : rank === "diamond" ? 18000 : rank === "all" ? 120000 : 45000;
  const games = Math.round(sampleBase * (pickRate / 10) * range(r, 0.8, 1.2));
  const rankChange = Math.round(range(r, -6, 6));
  return { winRate, pickRate, banRate, games, rankChange };
}

// 자체 메타 점수: 승률을 가장 크게, 픽률·밴율을 보조로 반영
function metaScore(s: { winRate: number; pickRate: number; banRate: number }) {
  return (s.winRate - 50) * 6 + Math.log1p(s.pickRate) * 8 + Math.log1p(s.banRate) * 3 + 50;
}

function tierOf(rankIndex: number, total: number): Tier {
  const p = rankIndex / total;
  if (p < 0.06) return "OP";
  if (p < 0.2) return "1";
  if (p < 0.45) return "2";
  if (p < 0.7) return "3";
  if (p < 0.88) return "4";
  return "5";
}

export function tierList(champions: Champion[], lane: Lane, rank: Rank, patch: string): ChampionStat[] {
  const rows = champions
    .filter((c) => lanesFor(c).includes(lane))
    .map((champion) => {
      const s = baseStat(champion, lane, rank, patch);
      return { champion, lane, ...s, score: metaScore(s) };
    })
    .sort((a, b) => b.score - a.score);
  return rows.map((row, i) => ({ ...row, tier: tierOf(i, rows.length) }));
}

export function championStat(champions: Champion[], champ: Champion, lane: Lane, rank: Rank, patch: string) {
  return tierList(champions, lane, rank, patch).find((s) => s.champion.id === champ.id) ?? null;
}

export type Matchup = { champion: Champion; winRate: number; games: number };

export function matchups(champions: Champion[], champ: Champion, lane: Lane, rank: Rank, patch: string) {
  const r = rng(`matchup:${champ.id}:${lane}:${rank}:${patch}`);
  const opponents = champions.filter((c) => c.id !== champ.id && lanesFor(c).includes(lane));
  const rows: Matchup[] = pickN(r, opponents, Math.min(16, opponents.length)).map((c) => ({
    champion: c,
    winRate: range(r, 42, 58),
    games: Math.round(range(r, 300, 6000)),
  }));
  rows.sort((a, b) => b.winRate - a.winRate);
  const half = Math.min(5, Math.floor(rows.length / 2));
  return { easy: rows.slice(0, half), hard: rows.slice(rows.length - half).reverse() };
}

export type BuildOption<T> = { value: T; winRate: number; pickRate: number };

const STARTERS = ["1055", "1056", "1054", "1082", "3865", "1101", "1102", "1103"];

function isLegendary(item: Item) {
  return (
    item.maps["11"] &&
    item.gold.purchasable &&
    item.inStore !== false &&
    !item.into?.length &&
    !item.requiredChampion &&
    !item.requiredAlly &&
    item.gold.total >= 2200 &&
    !item.tags.includes("Consumable") &&
    !item.tags.includes("Boots")
  );
}

function isBoots(item: Item) {
  return item.maps["11"] && item.gold.purchasable && item.tags.includes("Boots") && item.depth === 2;
}

// 챔피언 역할에 맞는 아이템 태그 선호
const TAG_ITEM_PREF: Record<string, string[]> = {
  Marksman: ["CriticalStrike", "AttackSpeed", "Damage"],
  Mage: ["SpellDamage", "Mana"],
  Assassin: ["Damage", "ArmorPenetration", "SpellDamage"],
  Fighter: ["Damage", "Health", "CooldownReduction", "AbilityHaste"],
  Tank: ["Health", "Armor", "SpellBlock"],
  Support: ["ManaRegen", "Health", "AbilityHaste", "Aura"],
};

function optionRates<T>(r: () => number, values: T[]): BuildOption<T>[] {
  let remaining = 100;
  return values.map((value, i) => {
    const pickRate = i === values.length - 1 ? remaining * range(r, 0.4, 0.8) : remaining * range(r, 0.35, 0.6);
    remaining -= pickRate;
    return { value, winRate: range(r, 47, 55), pickRate };
  });
}

export type RunePage = {
  primary: RuneTree;
  keystone: number;
  primaryRunes: number[];
  secondary: RuneTree;
  secondaryRunes: number[];
};

export type Build = {
  runes: BuildOption<RunePage>[];
  spells: BuildOption<SummonerSpell[]>[];
  skillOrder: BuildOption<string[]>[];
  starters: BuildOption<Item[]>[];
  core: BuildOption<Item[]>[];
  boots: BuildOption<Item>[];
};

const SPELLS_BY_LANE: Record<Lane, string[]> = {
  top: ["SummonerTeleport", "SummonerDot", "SummonerExhaust"],
  jungle: ["SummonerSmite"],
  mid: ["SummonerDot", "SummonerTeleport", "SummonerExhaust"],
  bottom: ["SummonerHeal", "SummonerExhaust", "SummonerBarrier"],
  support: ["SummonerDot", "SummonerExhaust", "SummonerHeal"],
};

export function build(
  champ: Champion,
  lane: Lane,
  rank: Rank,
  patch: string,
  items: Item[],
  trees: RuneTree[],
  spells: SummonerSpell[],
): Build {
  const r = rng(`build:${champ.id}:${lane}:${rank}:${patch}`);

  const runePages: RunePage[] = pickN(r, trees, 2).map((primary) => {
    const secondary = pick(r, trees.filter((t) => t.id !== primary.id));
    const secondarySlots = pickN(r, secondary.slots.slice(1), 2);
    return {
      primary,
      keystone: pick(r, primary.slots[0].runes).id,
      primaryRunes: primary.slots.slice(1).map((s) => pick(r, s.runes).id),
      secondary,
      secondaryRunes: secondarySlots.map((s) => pick(r, s.runes).id),
    };
  });

  const byId = new Map(spells.map((s) => [s.id, s]));
  const flash = byId.get("SummonerFlash");
  const spellSets = pickN(r, SPELLS_BY_LANE[lane], 2)
    .map((id) => [flash, byId.get(id)].filter((s): s is SummonerSpell => !!s));

  const orders = ["QWE", "QEW", "WQE", "EQW", "WEQ", "EWQ"];
  const skillOrder = pickN(r, orders, 2).map((o) => o.split(""));

  const itemById = new Map(items.map((i) => [i.id, i]));
  const starterPool = STARTERS.map((id) => itemById.get(id)).filter((i): i is Item => !!i);
  const potion = itemById.get("2003");
  const starters = pickN(r, starterPool, 2).map((i) => (potion ? [i, potion] : [i]));

  const prefs = champ.tags.flatMap((t) => TAG_ITEM_PREF[t] ?? []);
  const legendaries = items.filter(isLegendary);
  const preferred = legendaries.filter((i) => i.tags.some((t) => prefs.includes(t)));
  const pool = preferred.length >= 6 ? preferred : legendaries;
  const core = [0, 1, 2].map(() => pickN(r, pool, 3));

  const boots = pickN(r, items.filter(isBoots), 2);

  return {
    runes: optionRates(r, runePages),
    spells: optionRates(r, spellSets),
    skillOrder: optionRates(r, skillOrder),
    starters: optionRates(r, starters),
    core: optionRates(r, core),
    boots: optionRates(r, boots),
  };
}
