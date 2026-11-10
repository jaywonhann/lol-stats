// 챔피언 카운터 계산 (카운터 페이지와 그 공유 이미지가 같이 써요)
import type { Champion } from "@/lib/ddragon";
import type { Lane } from "@/lib/lanes";
import { loadRealData, MIN_PATCH_MATCHES, type PatchData } from "@/lib/real";

export const MIN_GAMES = 10; // 이보다 적게 만난 상대는 우연이 커서 빼요
export const PRIOR = 15; // 판수가 적은 상대는 평균 승률 쪽으로 당겨서 순위를 매겨요
// 두 목록이 겹치지 않게 절반까지만 (최대 12명)
export const half = (n: number) => Math.min(12, Math.floor(n / 2));

// 에메랄드+ 전체, 표본이 충분한 가장 최신 패치
export function latest(server: Parameters<typeof loadRealData>[0]["server"]): PatchData | null {
  try {
    const real = loadRealData({ server, rank: "all" });
    const ps = [...real.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const ok = ps.filter((p) => real.get(p)!.matches >= MIN_PATCH_MATCHES);
    const p = ok.at(-1) ?? ps.at(-1);
    return p ? real.get(p)! : null;
  } catch {
    return null;
  }
}

export function rows(data: PatchData, champ: Champion, lane: Lane, champions: Champion[]) {
  const c = data.champs[`${champ.key}:${lane}`];
  if (!c) return null;
  const byKey = new Map(champions.map((x) => [x.key, x]));
  const base = c.wins / c.games;
  const list = Object.entries(c.vs)
    .filter(([k, [g]]) => g >= MIN_GAMES && k !== champ.key && byKey.has(k))
    .map(([k, [g, w]]) => ({ champion: byKey.get(k)!, games: g, winRate: (w / g) * 100, score: (w + base * PRIOR) / (g + PRIOR) }));
  list.sort((a, b) => a.score - b.score);
  return { games: c.games, base: base * 100, counters: list.slice(0, half(list.length)), victims: [...list].reverse().slice(0, half(list.length)), total: list.length };
}
