// 실제 수집 데이터가 있으면 그걸 쓰고, 없으면 목업으로 대체하는 창구
import type { Champion } from "./ddragon";
import type { Filter, Lane } from "./lanes";
import {
  lanesFor,
  metaScore,
  movers as mockMovers,
  rankBoards,
  tierHistory,
  type ChampionStat,
} from "./mock";
import { loadRealData, realLanes, type PatchData } from "./real";

export type Source = "real" | "mock";

export function statsSource(patches: string[], filter: Filter) {
  const real = loadRealData(filter);
  const realPatches = patches.filter((p) => real.has(p));
  // 새 패치가 막 시작돼 아직 게임이 모자라면, 데이터가 있는 가장 최근 패치를 그대로 보여줍니다 (가짜 데이터로 바꾸지 않음)
  if (realPatches.length > 0)
    return { source: "real" as const, patches: realPatches, real };
  return { source: "mock" as const, patches, real };
}

function realBoards(
  champions: Champion[],
  lane: Lane,
  patches: string[],
  real: Map<string, PatchData>,
) {
  return rankBoards(
    patches.map((p) => {
      const d = real.get(p)!;
      return champions
        .map((champion) => {
          const c = d.champs[`${champion.key}:${lane}`];
          if (!c) return null;
          const pickRate = (c.games / d.matches) * 100;
          if (pickRate < 0.5) return null; // lol.ps처럼 픽률 0.5% 미만 제외
          if (c.games < 10) return null; // 몇 게임 안 된 챔피언이 승률 100%로 1등 하지 않게
          const winRate = (c.wins / c.games) * 100;
          const banRate = ((d.bans[champion.key] ?? 0) / d.matches) * 100;
          return {
            champion,
            patch: p,
            winRate,
            pickRate,
            banRate,
            games: c.games,
            score: metaScore({ winRate, pickRate, banRate }),
          };
        })
        .filter((r) => r !== null);
    }),
    lane,
  );
}

export function boards(
  champions: Champion[],
  lane: Lane,
  filter: Filter,
  allPatches: string[],
) {
  const s = statsSource(allPatches, filter);
  const b =
    s.source === "real"
      ? realBoards(champions, lane, s.patches, s.real)
      : tierHistory(champions, lane, filter.rank, s.patches);
  return { source: s.source, patches: s.patches, boards: b, real: s.real };
}

export function lanesOf(
  champ: Champion,
  allPatches: string[],
  filter: Filter,
): Lane[] {
  const s = statsSource(allPatches, filter);
  if (s.source === "real") {
    const lanes = realLanes(
      s.real.get(s.patches[s.patches.length - 1])!,
      champ,
    );
    if (lanes.length) return lanes;
  }
  return lanesFor(champ);
}

export function movers(
  champions: Champion[],
  lane: Lane,
  filter: Filter,
  allPatches: string[],
  count = 8,
) {
  const {
    source,
    boards: bs,
    patches,
  } = boards(champions, lane, filter, allPatches);
  if (source === "mock")
    return {
      source,
      patches,
      ...mockMovers(champions, lane, filter.rank, allPatches, count),
    };
  const latest = bs[bs.length - 1].filter((s) => s.scoreChange !== null);
  const sorted = [...latest].sort((a, b) => b.scoreChange! - a.scoreChange!);
  const sparkFor = (id: string) =>
    bs.map((b) => b.find((s) => s.champion.id === id)?.winRate ?? null);
  const pack = (s: ChampionStat) => ({
    stat: s,
    spark: sparkFor(s.champion.id),
  });
  return {
    source,
    patches,
    rising: sorted
      .slice(0, count)
      .filter((s) => s.scoreChange! > 0)
      .map(pack),
    falling: sorted
      .slice(-count)
      .reverse()
      .filter((s) => s.scoreChange! < 0)
      .map(pack),
  };
}

// 이번 패치에 승률이 가장 많이 오르고 내린 챔피언 (라인 구분 없이 전체에서).
// 두 패치 모두 판수가 충분한 챔피언만 봐요. 판수가 적으면 우연으로 크게 움직여 보여서요.
export const SWING_MIN_GAMES = 200;
export function patchSwings(champions: Champion[], filter: Filter, allPatches: string[], count = 5) {
  const { source, patches, real } = statsSource(allPatches, filter);
  const patch = patches.at(-1);
  const prev = patches.at(-2);
  if (source !== "real" || !patch || !prev) return null;
  const now = real.get(patch)!;
  const old = real.get(prev)!;
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const rows = Object.entries(now.champs).flatMap(([k, c]) => {
    const o = old.champs[k];
    const [key, lane] = k.split(":");
    const champion = byKey.get(key);
    if (!o || !champion || c.games < SWING_MIN_GAMES || o.games < SWING_MIN_GAMES) return [];
    const winRate = (c.wins / c.games) * 100;
    const before = (o.wins / o.games) * 100;
    return [{ champion, lane: lane as Lane, games: c.games, winRate, before, change: winRate - before }];
  });
  rows.sort((a, b) => b.change - a.change);
  return {
    patch,
    prev,
    matches: now.matches,
    up: rows.slice(0, count).filter((r) => r.change > 0),
    down: rows.slice(-count).reverse().filter((r) => r.change < 0),
  };
}
