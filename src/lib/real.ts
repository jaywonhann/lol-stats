// 실제 랭크 게임 집계 데이터 (scripts/collect.mjs 가 data/patches/*.json 에 저장)
import fs from "node:fs";
import path from "node:path";
import type { Champion, Item, RuneTree, SummonerSpell } from "./ddragon";
import type { Filter, Lane } from "./lanes";
import type { Build, BuildOption, Matchup, RunePage } from "./mock";

type Counts = Record<string, [number, number]>; // key -> [게임 수, 승리 수]

export type ChampAgg = {
  games: number;
  wins: number;
  runes: Counts;
  spells: Counts;
  starters: Counts;
  core: Counts;
  boots: Counts;
  skills: Counts;
  vs: Counts;
  core4?: Counts; // 먼저 완성한 코어템 4개 순서
  slots?: Counts; // "n:아이템ID" n번째로 완성한 코어템
  shards?: Counts; // "공격,유연,방어" 능력치 파편
};

export type PatchData = {
  patch: string;
  updatedAt: string;
  matches: number;
  bans: Record<string, number>;
  champs: Record<string, ChampAgg>; // "{championKey}:{lane}"
};

// 이 정도 게임이 모여야 화면에 보여줍니다
export const MIN_PATCH_MATCHES = 200;
export const MIN_CHAMP_GAMES = 20;

const ROOT = path.join(process.cwd(), "data", "patches");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function addCounts(into: Counts, from: Counts) {
  for (const [k, [g, w]] of Object.entries(from)) {
    const v = (into[k] ??= [0, 0]);
    v[0] += g;
    v[1] += w;
  }
}

// 여러 랭크 구간 데이터를 하나로 합치기
function merge(list: PatchData[]): PatchData {
  if (list.length === 1) return list[0];
  const out: PatchData = {
    patch: list[0].patch,
    updatedAt: list.map((d) => d.updatedAt).sort().at(-1)!,
    matches: 0,
    bans: {},
    champs: {},
  };
  for (const d of list) {
    out.matches += d.matches;
    for (const [k, n] of Object.entries(d.bans)) out.bans[k] = (out.bans[k] ?? 0) + n;
    for (const [k, c] of Object.entries(d.champs)) {
      const t = (out.champs[k] ??= {
        games: 0, wins: 0, runes: {}, spells: {}, starters: {}, core: {}, boots: {}, skills: {}, vs: {},
      });
      t.games += c.games;
      t.wins += c.wins;
      for (const key of ["runes", "spells", "starters", "core", "boots", "skills", "vs"] as const)
        addCounts(t[key], c[key]);
      for (const key of ["core4", "slots", "shards"] as const) if (c[key]) addCounts((t[key] ??= {}), c[key]);
    }
  }
  return out;
}

const cache = new Map<string, { stamp: string; data: Map<string, PatchData> }>();

// data/patches/{서버}/{랭크 구간}/{패치}.json. "전체"는 모든 구간(예전 수집분 포함)을 합칩니다.
export function loadRealData(filter: Filter): Map<string, PatchData> {
  const dir = path.join(ROOT, filter.server);
  if (!fs.existsSync(dir)) return new Map();
  const tiers = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (filter.rank === "all" || e.name === filter.rank))
    .map((e) => e.name);
  const files = tiers.flatMap((t) =>
    fs.readdirSync(path.join(dir, t)).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, t, f)),
  );
  const stamp = files.map((f) => `${f}:${fs.statSync(f).mtimeMs}`).join("|");
  const key = `${filter.server}/${filter.rank}`;
  const hit = cache.get(key);
  if (hit?.stamp === stamp) return hit.data;

  const byPatch = new Map<string, PatchData[]>();
  for (const f of files) {
    const d = readJson<PatchData>(f);
    byPatch.set(d.patch, [...(byPatch.get(d.patch) ?? []), d]);
  }
  const out = new Map<string, PatchData>();
  for (const [patch, list] of byPatch) {
    const d = merge(list);
    if (d.matches >= MIN_PATCH_MATCHES) out.set(patch, d);
  }
  cache.set(key, { stamp, data: out });
  return out;
}

// 서버에 실제 수집 데이터가 하나라도 있는지만 가볍게 확인합니다 (JSON을 읽지 않아서 모든 페이지에서 써도 빨라요)
export function hasRealData(server: Filter["server"]) {
  const dir = path.join(ROOT, server);
  if (!fs.existsSync(dir)) return false;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((e) => e.isDirectory() && fs.readdirSync(path.join(dir, e.name)).some((f) => f.endsWith(".json")));
}

export function realChamp(
  data: PatchData,
  champ: Champion,
  lane: Lane,
): ChampAgg | null {
  const c = data.champs[`${champ.key}:${lane}`];
  return c && c.games >= MIN_CHAMP_GAMES ? c : null;
}

export function realLanes(data: PatchData, champ: Champion): Lane[] {
  return (["top", "jungle", "mid", "bottom", "support"] as Lane[])
    .map((l) => ({ l, g: data.champs[`${champ.key}:${l}`]?.games ?? 0 }))
    .filter((x) => x.g >= MIN_CHAMP_GAMES)
    .sort((a, b) => b.g - a.g)
    .map((x) => x.l);
}

// 상위 n개 선택지를 승률·채택률과 함께. 표본이 너무 적은 선택지는 제외.
function top<T>(
  counts: Counts,
  n: number,
  map: (key: string) => T | null,
): BuildOption<T>[] {
  const total = Object.values(counts).reduce((s, [g]) => s + g, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1][0] - a[1][0])
    .filter(([, [g]]) => g >= 3)
    .map(([key, [g, w]]) => ({
      value: map(key),
      winRate: (w / g) * 100,
      pickRate: (g / total) * 100,
    }))
    .filter((o): o is BuildOption<T> => o.value !== null)
    .slice(0, n);
}

// 같은 의미의 키를 하나로 합치기 (예: 보조 룬 순서만 다른 페이지, 와드 토템이 섞인 시작템)
function regroup(counts: Counts, normalize: (key: string) => string | null): Counts {
  const out: Counts = {};
  for (const [key, [g, w]] of Object.entries(counts)) {
    const k = normalize(key);
    if (k === null) continue;
    const v = (out[k] ??= [0, 0]);
    v[0] += g;
    v[1] += w;
  }
  return out;
}

export function realBuild(
  c: ChampAgg,
  items: Item[],
  trees: RuneTree[],
  spells: SummonerSpell[],
): Build {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const isTrinket = (id: string) => itemById.get(id)?.tags.includes("Trinket") ?? false;
  const runes = regroup(c.runes, (key) => {
    const [pri, priRunes, sec, secRunes] = key.split("|");
    return [pri, priRunes, sec, secRunes.split(",").sort().join(",")].join("|");
  });
  const starters = regroup(c.starters, (key) => {
    const ids = key.split(",").filter((id) => !isTrinket(id));
    return ids.length ? ids.join(",") : null;
  });
  // 코어 3개 조합은 표본이 쉽게 흩어져서, 먼저 완성한 두 아이템 기준으로 묶습니다
  const core = regroup(c.core, (key) => key.split(",").slice(0, 2).join(","));
  const itemsOf = (key: string) => {
    const list = key.split(",").map((id) => itemById.get(id));
    return list.every(Boolean) ? (list as Item[]) : null;
  };
  const treeById = new Map(trees.map((t) => [t.id, t]));
  const spellByKey = new Map(spells.map((s) => [s.key, s]));

  return {
    runes: top<RunePage>(runes, 2, (key) => {
      const [pri, priRunes, sec, secRunes] = key.split("|");
      const primary = treeById.get(Number(pri));
      const secondary = treeById.get(Number(sec));
      if (!primary || !secondary) return null;
      const [keystone, ...primaryRunes] = priRunes.split(",").map(Number);
      return {
        primary,
        keystone,
        primaryRunes,
        secondary,
        secondaryRunes: secRunes.split(",").map(Number),
      };
    }),
    spells: top(c.spells, 3, (key) => {
      const list = key.split(",").map((k) => spellByKey.get(k));
      return list.every(Boolean) ? (list as SummonerSpell[]) : null;
    }),
    skillOrder: top(c.skills, 2, (key) => key.split("")),
    starters: top(starters, 3, itemsOf),
    core: top(core, 3, itemsOf),
    boots: top(c.boots, 3, (id) => itemById.get(id) ?? null),
  };
}

export type SlotOption = { item: Item; winRate: number; pickRate: number; games: number };

// 1~4코어: n번째로 완성한 코어템별 채택률·승률, 그리고 많이 쓰는 전체 코어 빌드 순서
export function realCorePath(c: ChampAgg, items: Item[]) {
  const itemById = new Map(items.map((i) => [i.id, i]));
  // 예전 데이터에는 slots가 없어서 3코어 순서에서 1~3코어를 계산합니다
  let slots = c.slots && Object.keys(c.slots).length ? c.slots : null;
  if (!slots) {
    slots = {};
    for (const [key, [g, w]] of Object.entries(c.core))
      key.split(",").forEach((id, i) => {
        const v = (slots![`${i + 1}:${id}`] ??= [0, 0]);
        v[0] += g;
        v[1] += w;
      });
  }
  const path: SlotOption[][] = [1, 2, 3, 4].map((n) => {
    const entries = Object.entries(slots!).filter(([k]) => k.startsWith(`${n}:`));
    const total = entries.reduce((s, [, [g]]) => s + g, 0);
    return entries
      .filter(([, [g]]) => g >= 3)
      .sort((a, b) => b[1][0] - a[1][0])
      .slice(0, 3)
      .flatMap(([k, [g, w]]) => {
        const item = itemById.get(k.split(":")[1]);
        return item ? [{ item, games: g, winRate: (w / g) * 100, pickRate: (g / total) * 100 }] : [];
      });
  });
  while (path.length && !path[path.length - 1].length) path.pop();
  const seqs = c.core4 && Object.values(c.core4).some(([g]) => g >= 3) ? c.core4 : c.core;
  const builds = top(seqs, 5, (key) => {
    const list = key.split(",").map((id) => itemById.get(id));
    return list.every(Boolean) ? (list as Item[]) : null;
  });
  return { path, builds };
}

export function realMatchups(
  c: ChampAgg,
  champ: Champion,
  champions: Champion[],
) {
  const byKey = new Map(champions.map((ch) => [ch.key, ch]));
  // 상대별 게임 수가 적어서, 순위는 내 평균 승률 쪽으로 당긴 값(10게임 가중)으로 정합니다
  const base = c.wins / c.games;
  const PRIOR = 10;
  const rows = Object.entries(c.vs)
    .filter(([key, [g]]) => g >= 3 && key !== champ.key) // 미러전 제외
    .map(([key, [g, w]]) => ({
      champion: byKey.get(key)!,
      winRate: (w / g) * 100,
      games: g,
      score: (w + base * PRIOR) / (g + PRIOR),
    }))
    .filter((m) => m.champion);
  rows.sort((a, b) => b.score - a.score);
  const half = Math.min(5, Math.floor(rows.length / 2));
  const strip = (m: (typeof rows)[number]): Matchup => ({ champion: m.champion, winRate: m.winRate, games: m.games });
  return {
    easy: rows.slice(0, half).map(strip),
    hard: rows.slice(rows.length - half).reverse().map(strip),
  };
}

export type WinRateRow<T> = { value: T; winRate: number; games: number };

// 표본이 충분한 선택지만 골라 승률 높은 순으로. 많이 쓰인 limit개 중에서 고릅니다.
function byWinRate<T>(
  counts: Counts,
  champGames: number,
  limit: number,
  map: (key: string) => T | null,
): WinRateRow<T>[] {
  const minGames = Math.max(20, Math.round(champGames * 0.05));
  return Object.entries(counts)
    .filter(([, [g]]) => g >= minGames)
    .sort((a, b) => b[1][0] - a[1][0])
    .slice(0, limit)
    .map(([key, [g, w]]) => ({ value: map(key), winRate: (w / g) * 100, games: g }))
    .filter((r): r is WinRateRow<T> => r.value !== null)
    .sort((a, b) => b.winRate - a.winRate);
}

// 승률 비교 그래프용: 핵심 룬+보조 빌드, 코어템 두 개 조합, 신발
export function realWinRates(c: ChampAgg, items: Item[], trees: RuneTree[], spells: SummonerSpell[] = []) {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const treeById = new Map(trees.map((t) => [t.id, t]));
  const runeById = new Map(
    trees.flatMap((t) => t.slots.flatMap((s) => s.runes)).map((r) => [r.id, r]),
  );
  // 룬은 핵심 룬과 보조 계열로만 묶어 표본을 모읍니다
  const runes = regroup(c.runes, (key) => {
    const [, priRunes, sec] = key.split("|");
    return `${priRunes.split(",")[0]}|${sec}`;
  });
  const core = regroup(c.core, (key) => key.split(",").slice(0, 2).join(","));
  const spellByKey = new Map(spells.map((sp) => [sp.key, sp]));
  return {
    spells: byWinRate(c.spells, c.games, 6, (key) => {
      const list = key.split(",").map((k) => spellByKey.get(k));
      return list.length === 2 && list.every(Boolean) ? (list as SummonerSpell[]) : null;
    }),
    runes: byWinRate(runes, c.games, 8, (key) => {
      const [ks, sec] = key.split("|").map(Number);
      const keystone = runeById.get(ks);
      const secondary = treeById.get(sec);
      return keystone && secondary ? { keystone, secondary } : null;
    }),
    core: byWinRate(core, c.games, 8, (key) => {
      const list = key.split(",").map((id) => itemById.get(id));
      return list.every(Boolean) ? (list as Item[]) : null;
    }),
    boots: byWinRate(c.boots, c.games, 6, (id) => itemById.get(id) ?? null),
  };
}

export type Activity = { updatedAt: string; hours: Record<string, number> };

// 서버별 시간대별 게임 수 (scripts/collect.mjs 가 activity.json 에 기록)
export function loadActivity(server: Filter["server"]) {
  const file = path.join(ROOT, server, "activity.json");
  if (!fs.existsSync(file)) return null;
  const a = readJson<Activity>(file);
  const end = new Date(a.updatedAt).getTime();
  // 수집 시각 기준 최근 24시간, 1시간 단위
  const hours = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(end - (23 - i) * 3_600_000);
    return { at: t.toISOString(), games: a.hours[t.toISOString().slice(0, 13)] ?? 0 };
  });
  return { updatedAt: a.updatedAt, hours, total: hours.reduce((s, h) => s + h.games, 0) };
}

// 가장 많이 쓴 능력치 파편 [공격, 유연, 방어]. 아직 모인 게임이 없으면 null
export function realShards(c: ChampAgg): number[] | null {
  const top = Object.entries(c.shards ?? {}).sort((a, b) => b[1][0] - a[1][0])[0];
  if (!top || top[1][0] < 3) return null;
  const ids = top[0].split(",").map(Number);
  return ids.length === 3 && ids.every(Number.isFinite) ? ids : null;
}
