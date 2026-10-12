// 소환사 최근 솔로랭크 게임 분석 (규칙 기반, 외부 호출 없음)
import type { Champion } from "./ddragon";
import type { Lane } from "./lanes";
import { loadRealData, MIN_CHAMP_GAMES } from "./real";
import type { Match, Participant } from "./riot";
import type { Server } from "./lanes";

const POSITION: Record<string, Lane> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  BOTTOM: "bottom",
  UTILITY: "support",
};

export const METRICS = ["cs", "gold", "dmg", "vision", "kp", "deaths"] as const;
export type Metric = (typeof METRICS)[number];

type Line = Record<Metric, number>;

export type Game = {
  id: string;
  win: boolean;
  championId: number;
  championName: string;
  lane: Lane | null;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  csPerMin: number;
  endedAt: number;
  me: Line;
  opp: Line | null;
};

const line = (p: Participant, teamKills: number, minutes: number): Line => ({
  cs: (p.totalMinionsKilled + p.neutralMinionsKilled) / minutes,
  gold: p.goldEarned / minutes,
  dmg: p.totalDamageDealtToChampions / minutes,
  vision: p.visionScore / minutes,
  kp: teamKills ? (p.kills + p.assists) / teamKills : 0,
  deaths: p.deaths,
});

// 다시하기(5분 미만) 게임은 빼고, 최신 → 오래된 순서를 유지합니다
export function toGames(matches: Match[], puuid: string): Game[] {
  const out: Game[] = [];
  for (const m of matches) {
    const ps = m.info.participants;
    const me = ps.find((p) => p.puuid === puuid);
    if (!me || m.info.gameDuration < 300) continue;
    const minutes = m.info.gameDuration / 60;
    const kills = (team: number) =>
      ps.filter((p) => p.teamId === team).reduce((s, p) => s + p.kills, 0);
    const opp = me.teamPosition
      ? ps.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition)
      : undefined;
    out.push({
      id: m.metadata.matchId,
      win: me.win,
      championId: me.championId,
      championName: me.championName,
      lane: POSITION[me.teamPosition] ?? null,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      minutes,
      csPerMin: (me.totalMinionsKilled + me.neutralMinionsKilled) / minutes,
      endedAt: m.info.gameEndTimestamp ?? m.info.gameCreation,
      me: line(me, kills(me.teamId), minutes),
      opp: opp ? line(opp, kills(opp.teamId), minutes) : null,
    });
  }
  return out.sort((a, b) => b.endedAt - a.endedAt);
}

export type ChampSummary = {
  championId: number;
  championName: string;
  champion: Champion | null;
  games: number;
  wins: number;
  winRate: number;
  kda: number;
  csPerMin: number;
  lane: Lane | null;
  siteWinRate: number | null;
};

const mode = <T>(xs: T[]): T | null => {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const patchNum = (p: string) => p.split(".").map(Number);

// 사이트 실제 집계(가장 최근 패치, 에메랄드+)에서 챔피언+라인 평균 승률
export function siteAverages(server: Server) {
  const real = loadRealData({ server, rank: "all" });
  const patch = [...real.keys()].sort((a, b) => {
    const [a1, a2] = patchNum(a);
    const [b1, b2] = patchNum(b);
    return a1 - b1 || a2 - b2;
  }).at(-1);
  const data = patch ? real.get(patch) : undefined;
  return {
    patch: patch ?? null,
    winRate(champKey: string, lane: Lane): number | null {
      const c = data?.champs[`${champKey}:${lane}`];
      return c && c.games >= MIN_CHAMP_GAMES ? (c.wins / c.games) * 100 : null;
    },
  };
}

export function champSummaries(
  games: Game[],
  champions: Champion[],
  avg: ReturnType<typeof siteAverages>,
): ChampSummary[] {
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const groups = new Map<number, Game[]>();
  for (const g of games) groups.set(g.championId, [...(groups.get(g.championId) ?? []), g]);
  return [...groups.values()]
    .map((gs) => {
      const wins = gs.filter((g) => g.win).length;
      const sum = (f: (g: Game) => number) => gs.reduce((s, g) => s + f(g), 0);
      const champion = byKey.get(String(gs[0].championId)) ?? null;
      const lane = mode(gs.map((g) => g.lane).filter((l): l is Lane => l !== null));
      return {
        championId: gs[0].championId,
        championName: champion?.name ?? gs[0].championName,
        champion,
        games: gs.length,
        wins,
        winRate: (wins / gs.length) * 100,
        kda: (sum((g) => g.kills) + sum((g) => g.assists)) / Math.max(1, sum((g) => g.deaths)),
        csPerMin: sum((g) => g.csPerMin) / gs.length,
        lane,
        siteWinRate: lane ? avg.winRate(String(gs[0].championId), lane) : null,
      };
    })
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);
}

export function roles(games: Game[]) {
  const c = new Map<Lane, number>();
  for (const g of games) if (g.lane) c.set(g.lane, (c.get(g.lane) ?? 0) + 1);
  return [...c].map(([lane, games]) => ({ lane, games })).sort((a, b) => b.games - a.games);
}

// 맞라이너 대비: 평균값끼리 비교해 상대 대비 %로. 데스는 적을수록 좋으니 부호를 뒤집습니다 (+ = 내가 더 좋음).
export function laneDiffs(games: Game[]) {
  const vs = games.filter((g) => g.opp);
  if (!vs.length) return { games: 0, diffs: [] as { metric: Metric; value: number }[] };
  const avg = (f: (g: Game) => number) => vs.reduce((s, g) => s + f(g), 0) / vs.length;
  const diffs = METRICS.flatMap((metric) => {
    const me = avg((g) => g.me[metric]);
    const op = avg((g) => g.opp![metric]);
    if (op <= 0 && me <= 0) return [{ metric, value: 0 }];
    // 상대 값이 0이면 비교 기준이 없어 ±100%로 둡니다
    const rel = op > 0 ? ((me - op) / op) * 100 : 100;
    const value = Math.max(-100, Math.min(200, metric === "deaths" ? -rel : rel));
    return [{ metric, value }];
  });
  return { games: vs.length, diffs };
}

export function strengthsWeaknesses(diffs: { metric: Metric; value: number }[]) {
  const sorted = [...diffs].sort((a, b) => b.value - a.value);
  return {
    strengths: sorted.filter((d) => d.value >= 3).slice(0, 2),
    weaknesses: sorted
      .filter((d) => d.value <= -3)
      .reverse()
      .slice(0, 2),
  };
}

export function form(games: Game[]) {
  // 오래된 → 최신
  const chrono = [...games].reverse();
  let run = 0;
  const cumulative = chrono.map((g) => (run += g.win ? 1 : -1));
  const wins = games.filter((g) => g.win).length;
  let streak = 0;
  for (const g of games) {
    if (g.win !== games[0].win) break;
    streak++;
  }
  return {
    chrono,
    cumulative,
    wins,
    losses: games.length - wins,
    winRate: games.length ? (wins / games.length) * 100 : 0,
    streak: games.length ? { win: games[0].win, count: streak } : null,
  };
}
