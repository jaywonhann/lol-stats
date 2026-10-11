// 목업 통계: 실제 랭크 게임 데이터가 모이기 전까지 티어 리스트·트렌드에만 쓰는 가짜 데이터.
// 빌드(아이템·룬 등)는 목업으로 만들지 않고, 실제 데이터가 있을 때만 보여줍니다.
// 같은 챔피언·라인·랭크 조합이면 항상 같은 값이 나오도록 시드 기반 난수를 씁니다.
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

const range = (r: () => number, min: number, max: number) =>
  min + r() * (max - min);

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
  for (const l of champ.tags.flatMap((t) => TAG_LANES[t] ?? []))
    if (r() < 0.35) lanes.add(l);
  return [...lanes];
}

export type Tier = "OP" | "1" | "2" | "3" | "4" | "5";

export type PatchStat = {
  patch: string;
  winRate: number;
  pickRate: number;
  banRate: number;
  games: number;
  score: number;
};

export type ChampionStat = PatchStat & {
  champion: Champion;
  lane: Lane;
  tier: Tier;
  rank: number;
  // 이전 패치 대비 순위 변동 (양수 = 상승). 이전 패치에 없었으면 null
  rankChange: number | null;
  scoreChange: number | null;
  winRateChange: number | null;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const sampleBase = (rank: Rank) =>
  rank === "master"
    ? 4000
    : rank === "diamond"
      ? 18000
      : rank === "all"
        ? 120000
        : 45000;

// 자체 메타 점수: 승률을 가장 크게, 픽률·밴율을 보조로 반영
function metaScore(s: { winRate: number; pickRate: number; banRate: number }) {
  return (
    (s.winRate - 50) * 6 +
    Math.log1p(s.pickRate) * 8 +
    Math.log1p(s.banRate) * 3 +
    50
  );
}

// 패치별 통계: 패치마다 조금씩 변하는 랜덤 워크라서 상승·하락 추세가 자연스럽게 이어집니다.
// patches는 오래된 패치 -> 최신 패치 순서.
export function history(
  champ: Champion,
  lane: Lane,
  rank: Rank,
  patches: string[],
): PatchStat[] {
  const r0 = rng(`base:${champ.id}:${lane}:${rank}`);
  const isMain = lanesFor(champ)[0] === lane;
  let winRate = range(r0, 47.5, 52.5);
  let pickRate = isMain ? range(r0, 1.5, 12) : range(r0, 0.6, 3.5);
  let banRate = r0() < 0.75 ? range(r0, 0.2, 5) : range(r0, 5, 30);
  let trend = range(r0, -0.6, 0.6); // 챔피언마다 다른 버프/너프 흐름
  return patches.map((patch) => {
    const r = rng(`patch:${champ.id}:${lane}:${rank}:${patch}`);
    if (r() < 0.25) trend = range(r, -0.9, 0.9); // 가끔 버프/너프로 흐름이 바뀜
    winRate = clamp(
      winRate + trend + range(r, -0.7, 0.7) - (winRate - 50) * 0.15,
      45,
      55,
    );
    pickRate = clamp(
      pickRate * (1 + trend * 0.12 + range(r, -0.12, 0.12)),
      0.5,
      20,
    );
    banRate = clamp(
      banRate * (1 + trend * 0.1 + range(r, -0.15, 0.15)),
      0.1,
      45,
    );
    const games = Math.round(
      sampleBase(rank) * (pickRate / 10) * range(r, 0.85, 1.15),
    );
    return {
      patch,
      winRate,
      pickRate,
      banRate,
      games,
      score: metaScore({ winRate, pickRate, banRate }),
    };
  });
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

// 패치별 원시 통계 -> 순위·티어·이전 패치 대비 변동이 붙은 순위표
export function rankBoards(
  perPatch: (PatchStat & { champion: Champion })[][],
  lane: Lane,
): ChampionStat[][] {
  const boards: ChampionStat[][] = [];
  perPatch.forEach((rowsRaw, pi) => {
    const hasPrev = pi > 0;
    const prevById = new Map(boards[pi - 1]?.map((s) => [s.champion.id, s]));
    const rows = [...rowsRaw]
      .sort((a, b) => b.score - a.score)
      .map((row, i, arr) => {
        const before = prevById.get(row.champion.id);
        return {
          ...row,
          lane,
          rank: i + 1,
          tier: tierOf(i, arr.length),
          // 이전 패치 순위표에 없던 챔피언은 null(NEW), 이전 패치 데이터 자체가 없으면 0
          rankChange: before ? before.rank - (i + 1) : hasPrev ? null : 0,
          scoreChange: before ? row.score - before.score : null,
          winRateChange: before ? row.winRate - before.winRate : null,
        };
      });
    boards.push(rows);
  });
  return boards;
}

export { metaScore };

// 한 라인·랭크 구간의 패치별 순위표 전체 (목업). patches는 오래된 -> 최신 순서.
export function tierHistory(
  champions: Champion[],
  lane: Lane,
  rank: Rank,
  patches: string[],
): ChampionStat[][] {
  const pool = champions.filter((c) => lanesFor(c).includes(lane));
  const all = pool.map((champion) => ({
    champion,
    stats: history(champion, lane, rank, patches),
  }));
  return rankBoards(
    patches.map((_, pi) =>
      all.map(({ champion, stats }) => ({ champion, ...stats[pi] })),
    ),
    lane,
  );
}

export function movers(
  champions: Champion[],
  lane: Lane,
  rank: Rank,
  patches: string[],
  count = 8,
) {
  const boards = tierHistory(champions, lane, rank, patches);
  const latest = boards[boards.length - 1].filter(
    (s) => s.scoreChange !== null,
  );
  const sorted = [...latest].sort((a, b) => b.scoreChange! - a.scoreChange!);
  const sparkFor = (id: string) =>
    boards.map((b) => b.find((s) => s.champion.id === id)?.winRate ?? null);
  return {
    rising: sorted
      .slice(0, count)
      .filter((s) => s.scoreChange! > 0)
      .map((s) => ({ stat: s, spark: sparkFor(s.champion.id) })),
    falling: sorted
      .slice(-count)
      .reverse()
      .filter((s) => s.scoreChange! < 0)
      .map((s) => ({ stat: s, spark: sparkFor(s.champion.id) })),
  };
}

export type Matchup = { champion: Champion; winRate: number; games: number };

export type BuildOption<T> = { value: T; winRate: number; pickRate: number };

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
