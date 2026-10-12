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
  const latest = patches[patches.length - 1];
  if (real.has(latest))
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
