// 인분 점수 · 팀운 · 캐리력 (자체 계산식, 외부 호출 없음)
// 한 판의 10명을 같은 기준으로 비교해 "평균 선수 = 1.0인분"으로 환산합니다.
import type { Match, Participant, Timeline } from "./riot";

export const AXES = ["dmg", "kp", "survive", "vision", "growth"] as const;
export type Axis = (typeof AXES)[number];

// 포지션별로 기대되는 딜/시야 비중이 달라서 보정합니다 (서포터가 딜이 낮은 건 정상)
const DMG_EXPECT: Record<string, number> = { TOP: 1, JUNGLE: 0.8, MIDDLE: 1.2, BOTTOM: 1.4, UTILITY: 0.4 };
const VIS_EXPECT: Record<string, number> = { TOP: 0.7, JUNGLE: 1.1, MIDDLE: 0.8, BOTTOM: 0.6, UTILITY: 2.3 };
const WEIGHT: Record<string, Record<Axis, number>> = {
  UTILITY: { dmg: 0.1, kp: 0.3, survive: 0.2, vision: 0.3, growth: 0.1 },
  JUNGLE: { dmg: 0.25, kp: 0.3, survive: 0.15, vision: 0.15, growth: 0.15 },
  DEFAULT: { dmg: 0.35, kp: 0.2, survive: 0.15, vision: 0.1, growth: 0.2 },
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export type Rated = { puuid: string; teamId: number; axes: Record<Axis, number>; inbun: number };

// 한 판의 10명을 평가. axes는 1.0 = 평균, inbun은 가중합
export function rateMatch(m: Match): Rated[] {
  const ps = m.info.participants;
  const minutes = m.info.gameDuration / 60;
  if (ps.length < 2 || minutes <= 0) return [];
  const teamKills = (t: number) => ps.filter((p) => p.teamId === t).reduce((s, p) => s + p.kills, 0);
  const raw = (p: Participant) => {
    const tk = teamKills(p.teamId);
    return {
      dmg: p.totalDamageDealtToChampions / minutes / (DMG_EXPECT[p.teamPosition] ?? 1),
      kp: tk ? (p.kills + p.assists) / tk : 0,
      survive: 1 / (1 + p.deaths),
      vision: p.visionScore / minutes / (VIS_EXPECT[p.teamPosition] ?? 1),
      growth: (p.goldEarned / minutes) * 0.7 + ((p.totalMinionsKilled + p.neutralMinionsKilled) / minutes) * 30 * 0.3,
    };
  };
  const rows = ps.map((p) => ({ p, r: raw(p) }));
  const avg = Object.fromEntries(AXES.map((a) => [a, mean(rows.map((x) => x.r[a])) || 1])) as Record<Axis, number>;
  return rows.map(({ p, r }) => {
    const axes = Object.fromEntries(AXES.map((a) => [a, avg[a] ? r[a] / avg[a] : 1])) as Record<Axis, number>;
    const w = WEIGHT[p.teamPosition] ?? WEIGHT.DEFAULT;
    const inbun = AXES.reduce((s, a) => s + w[a] * clamp(axes[a], 0, 3), 0);
    return { puuid: p.puuid, teamId: p.teamId, axes, inbun };
  });
}

export type GameScore = {
  id: string;
  win: boolean;
  championName: string;
  inbun: number; // 1.0 = 평균
  luck: number; // 아군 평균 인분 - 상대 평균 인분
};

// Riot이 준 값을 그대로 계산한 실제 수치 (최근 게임 평균)
export type RealStats = {
  dmgShare: number; // 팀 내 딜량 비중 %
  goldShare: number; // 팀 내 골드 비중 %
  kp: number; // 킬관여 %
  kda: number;
  visionPerMin: number;
  csPerMin: number;
  // 같은 포지션 상대와의 차이 (타임라인이 있는 게임만)
  csDiff10: number | null;
  goldDiff15: number | null;
  timelineGames: number;
};

export type ScoreReport = {
  real: RealStats;
  games: GameScore[];
  avgInbun: number;
  luck: number; // 0~100, 50 = 평균 팀운
  luckRaw: number;
  radar: Record<Axis, number>; // 0~100, 50 = 평균
  carry: number; // 0~100
  carriedLosses: number; // 졌지만 1.2인분 이상
  weakWins: number; // 이겼지만 0.8인분 미만 (버스 탄 판)
};

function frameAt(tl: Timeline, puuid: string, minute: number) {
  const id = tl.info.participants.find((p) => p.puuid === puuid)?.participantId;
  const f = tl.info.frames[minute]?.participantFrames[String(id)];
  return f ? { gold: f.totalGold, cs: f.minionsKilled + f.jungleMinionsKilled } : null;
}

export function scoreReport(
  matches: Match[],
  puuid: string,
  timelines: Record<string, Timeline> = {},
): ScoreReport | null {
  const real = { dmg: [] as number[], gold: [] as number[], kp: [] as number[], kda: [] as number[], vis: [] as number[], cs: [] as number[], cs10: [] as number[], g15: [] as number[] };
  const games: GameScore[] = [];
  const radarSum = Object.fromEntries(AXES.map((a) => [a, [] as number[]])) as Record<Axis, number[]>;
  for (const m of matches) {
    if (m.info.gameDuration < 300) continue;
    const rated = rateMatch(m);
    const me = rated.find((r) => r.puuid === puuid);
    if (!me) continue;
    const mates = rated.filter((r) => r.teamId === me.teamId && r.puuid !== puuid);
    const foes = rated.filter((r) => r.teamId !== me.teamId);
    const win = m.info.participants.find((p) => p.puuid === puuid)!.win;
    const champ = m.info.participants.find((p) => p.puuid === puuid)!.championName;
    games.push({
      id: m.metadata.matchId,
      win,
      championName: champ,
      inbun: me.inbun,
      luck: mean(mates.map((r) => r.inbun)) - mean(foes.map((r) => r.inbun)),
    });
    for (const a of AXES) radarSum[a].push(me.axes[a]);
    const ps = m.info.participants;
    const mp = ps.find((p) => p.puuid === puuid)!;
    const team = ps.filter((p) => p.teamId === mp.teamId);
    const sum = (f: (p: Participant) => number) => team.reduce((s, p) => s + f(p), 0);
    const min = m.info.gameDuration / 60;
    real.dmg.push((mp.totalDamageDealtToChampions / (sum((p) => p.totalDamageDealtToChampions) || 1)) * 100);
    real.gold.push((mp.goldEarned / (sum((p) => p.goldEarned) || 1)) * 100);
    real.kp.push(((mp.kills + mp.assists) / (sum((p) => p.kills) || 1)) * 100);
    real.kda.push((mp.kills + mp.assists) / Math.max(1, mp.deaths));
    real.vis.push(mp.visionScore / min);
    real.cs.push((mp.totalMinionsKilled + mp.neutralMinionsKilled) / min);
    const tl = timelines[m.metadata.matchId];
    const opp = mp.teamPosition
      ? ps.find((p) => p.teamId !== mp.teamId && p.teamPosition === mp.teamPosition)
      : undefined;
    if (tl && opp) {
      const a10 = frameAt(tl, puuid, 10), b10 = frameAt(tl, opp.puuid, 10);
      const a15 = frameAt(tl, puuid, 15), b15 = frameAt(tl, opp.puuid, 15);
      if (a10 && b10) real.cs10.push(a10.cs - b10.cs);
      if (a15 && b15) real.g15.push(a15.gold - b15.gold);
    }
  }
  if (!games.length) return null;
  const avgInbun = mean(games.map((g) => g.inbun));
  const luckRaw = mean(games.map((g) => g.luck));
  const to100 = (ratio: number) => Math.round(clamp(50 + (ratio - 1) * 50, 5, 100));
  const radar = Object.fromEntries(AXES.map((a) => [a, to100(mean(radarSum[a]))])) as Record<Axis, number>;
  // 캐리력: 평균 인분을 0~100으로 환산 (1.0인분 = 50점)
  const carry = Math.round(clamp(50 + (avgInbun - 1) * 100, 5, 100));
  return {
    real: {
      dmgShare: mean(real.dmg),
      goldShare: mean(real.gold),
      kp: mean(real.kp),
      kda: mean(real.kda),
      visionPerMin: mean(real.vis),
      csPerMin: mean(real.cs),
      csDiff10: real.cs10.length ? mean(real.cs10) : null,
      goldDiff15: real.g15.length ? mean(real.g15) : null,
      timelineGames: Math.max(real.cs10.length, real.g15.length),
    },
    games,
    avgInbun,
    luckRaw,
    luck: Math.round(clamp(50 + luckRaw * 100, 5, 100)),
    radar,
    carry,
    carriedLosses: games.filter((g) => !g.win && g.inbun >= 1.2).length,
    weakWins: games.filter((g) => g.win && g.inbun < 0.8).length,
  };
}
