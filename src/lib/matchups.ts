import { loadRealData } from "@/lib/real";
import type { Lane } from "@/lib/lanes";

export type TopMatchup = { a: string; b: string; lane: Lane; games: number; wins: number };

// 세 서버 최신 패치에서 표본이 많은 상성 조합 (a, b는 챔피언 key 숫자 문자열)
export function topMatchups(minGames = 10): TopMatchup[] {
  const map = new Map<string, TopMatchup>();
  for (const server of ["kr", "na1", "euw1"] as const) {
    const real = loadRealData({ server, rank: "all" });
    const patch = [...real.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).pop();
    if (!patch) continue;
    for (const [k, v] of Object.entries(real.get(patch)!.champs)) {
      const [a, lane] = k.split(":");
      for (const [b, [g, w]] of Object.entries(v.vs)) {
        if (g < minGames) continue;
        const id = `${a}:${b}:${lane}`;
        const cur = map.get(id) ?? { a, b, lane: lane as Lane, games: 0, wins: 0 };
        cur.games += g;
        cur.wins += w;
        map.set(id, cur);
      }
    }
  }
  return [...map.values()].sort((x, y) => y.games - x.games);
}
