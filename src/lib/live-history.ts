import type { Server } from "./lanes";

export type LivePoint = { at: string; estimate: number; total: number };

const DAY = 24 * 3_600_000;

// GitHub Actions(live-history.yml)가 10분마다 live-data 브랜치에 남기는 기록 중 최근 24시간
export async function liveHistory(server: Server): Promise<LivePoint[]> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/jaywonhann/lol-stats/live-data/${server}.json`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { points?: LivePoint[] };
    return (data.points ?? [])
      .filter((p) => Date.now() - new Date(p.at).getTime() < DAY)
      .map(({ at, estimate, total }) => ({ at, estimate, total }));
  } catch {
    return [];
  }
}
