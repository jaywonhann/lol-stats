import type { Server } from "./lanes";

export type LivePoint = { at: string; estimate: number; total: number; v?: number };
export type LiveGame = { id: number; at: string; champs: number[]; ps?: number[][] };

const DAY = 24 * 3_600_000;

async function load(server: Server) {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/jaywonhann/lol-stats/live-data/${server}.json`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as { points?: LivePoint[]; games?: LiveGame[] };
  } catch {
    return null;
  }
}

// GitHub Actions(live-history.yml)가 10분마다 live-data 브랜치에 남기는 기록 중 최근 24시간
export async function liveHistory(server: Server): Promise<LivePoint[]> {
  const data = await load(server);
  // v:2 = 전체 플레이어 추정. 예전(마스터+ 랭커 수) 기록은 규모가 달라서 뺍니다
  return (data?.points ?? [])
    .filter((p) => p.v === 2 && Date.now() - new Date(p.at).getTime() < DAY)
    .map(({ at, estimate, total }) => ({ at, estimate, total }));
}

// 표본으로 잡힌 진행 중 랭크 게임에서 챔피언별 등장 횟수 (최근 1시간, 게임이 적으면 2시간)
export async function liveChampions(server: Server) {
  // 이미 쌓인 기록에 같은 게임이 두 번 들어가 있어도 한 번만 센다
  const games = [...new Map(((await load(server))?.games ?? []).map((g) => [g.id, g])).values()];
  const within = (h: number) =>
    games.filter((g) => Date.now() - new Date(g.at).getTime() < h * 3_600_000);
  let hours = 1;
  let pool = within(1);
  if (pool.length < 5) {
    hours = 2;
    pool = within(2);
  }
  const counts = new Map<number, number>();
  for (const g of pool) for (const c of g.champs) counts.set(c, (counts.get(c) ?? 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => ({ key: String(key), n }));
  const last = pool.reduce((m, g) => (g.at > m ? g.at : m), "");
  const picks = pool.reduce((s, g) => s + g.champs.length, 0);
  return { games: pool.length, picks, hours, top, updatedAt: last || null };
}

// 지금 이 챔피언을 쓰는 라이브 게임 표본에서 룬(핵심 룬·보조 계열)과 소환사 주문 사용 횟수 (최근 6시간)
export async function liveChampionBuild(server: Server, champKey: string) {
  const games = [...new Map(((await load(server))?.games ?? []).map((g) => [g.id, g])).values()];
  const mine = games
    .filter((g) => Date.now() - new Date(g.at).getTime() < 6 * 3_600_000)
    .flatMap((g) => (g.ps ?? []).filter((p) => String(p[0]) === champKey));
  const tally = (keyOf: (p: number[]) => string) => {
    const m = new Map<string, number>();
    for (const p of mine) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n }));
  };
  const last = games.reduce((m, g) => (g.at > m ? g.at : m), "");
  return {
    players: mine.length,
    keystones: tally((p) => String(p[5])), // 첫 번째 룬이 핵심 룬
    secondaries: tally((p) => String(p[4])),
    spells: tally((p) => [p[1], p[2]].sort((a, b) => a - b).join(",")),
    updatedAt: last || null,
  };
}
