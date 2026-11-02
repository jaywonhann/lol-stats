// PRO "내 롤 사용설명서": 최근 솔로랭크 게임을 판 순서·연패·게임 길이·챔피언별로 쪼개
// "몇 연패면 끄기", "하루 몇 판까지", "어떤 챔프로 올리기" 같은 나만의 규칙을 만듭니다.
// 순수 규칙 기반이고 모든 입력이 실제 전적이에요. 표본이 적은 칸은 규칙으로 쓰지 않아요.
import type { ChampSummary, Game } from "./summoner";

export type Bucket = { n: number; w: number; rate: number | null };

const MIN = 3; // 칸 하나를 규칙으로 쓰려면 최소 판 수
const BAD = 45; // 이 승률 밑이면 "손해 보는 구간"
const GOOD = 55;

const bucket = (gs: Game[]): Bucket => {
  const w = gs.filter((g) => g.win).length;
  return { n: gs.length, w, rate: gs.length ? (w / gs.length) * 100 : null };
};

const ok = (b: Bucket) => b.n >= MIN && b.rate !== null;

export const startOf = (g: Game) => g.endedAt - g.minutes * 60000;

// 90분 넘게 쉬면 새 세션(그날 접속)으로 봅니다
const SESSION_GAP = 90 * 60000;

export function deepReport(games: Game[], champs: ChampSummary[]) {
  const chrono = [...games].reverse();
  const pos: number[] = []; // 세션 안에서 몇 번째 판인지 (0부터)
  const lossesBefore: number[] = []; // 같은 세션에서 바로 앞까지 이어진 패배 수
  let sessions = 0;
  chrono.forEach((g, i) => {
    const prev = chrono[i - 1];
    const fresh = !prev || startOf(g) - prev.endedAt > SESSION_GAP;
    if (fresh) sessions++;
    pos.push(fresh ? 0 : pos[i - 1] + 1);
    lossesBefore.push(fresh ? 0 : prev.win ? 0 : lossesBefore[i - 1] + 1);
  });

  const byPos = [0, 1, 2, 3].map((p) => bucket(chrono.filter((_, i) => (p < 3 ? pos[i] === p : pos[i] >= 3))));
  const byStreak = [0, 1, 2].map((k) => bucket(chrono.filter((_, i) => (k < 2 ? lossesBefore[i] === k : lossesBefore[i] >= 2))));
  const byLength = [
    bucket(games.filter((g) => g.minutes < 25)),
    bucket(games.filter((g) => g.minutes >= 25 && g.minutes < 32)),
    bucket(games.filter((g) => g.minutes >= 32)),
  ];
  const overall = bucket(games);

  // 몇 연패에서 끊어야 하나: 1패 뒤부터 승률이 무너지면 1, 2연패 뒤에 무너지면 2
  const stopAfter = ok(byStreak[1]) && byStreak[1].rate! < BAD ? 1 : ok(byStreak[2]) && byStreak[2].rate! < BAD ? 2 : null;
  // 하루 몇 판까지: 승률이 처음으로 무너지는 판 직전까지 (첫 판부터 나쁘면 규칙 없음)
  let maxGames: number | null = null;
  for (let p = 1; p < 4; p++)
    if (ok(byPos[p]) && byPos[p].rate! < BAD) {
      maxGames = p;
      break;
    }
  // 짧은 게임 vs 긴 게임
  const short = byLength[0];
  const long = byLength[2];
  const style =
    ok(short) && ok(long) && Math.abs(short.rate! - long.rate!) >= 12 ? (short.rate! > long.rate! ? "early" : "late") : null;

  const pool = champs.filter((c) => c.games >= MIN);
  const keep = pool
    .filter((c) => c.winRate >= GOOD)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .slice(0, 3);
  const drop = pool
    .filter((c) => c.winRate <= 40)
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
    .slice(0, 2);

  // 최근 20판 vs 그 전
  const recent = bucket(games.slice(0, 20));
  const before = bucket(games.slice(20));
  const momentum = ok(recent) && before.n >= 10 ? recent.rate! - before.rate! : null;

  // 시간대 분석은 보는 사람의 시간대로 해야 해서 브라우저에서 계산해요 (시작 시각 + 승패만 넘김)
  const hours = chrono.map((g) => ({ t: startOf(g), w: g.win }));

  return { games: games.length, sessions, overall, byPos, byStreak, byLength, stopAfter, maxGames, style, keep, drop, recent, before, momentum, hours };
}

export type DeepReport = ReturnType<typeof deepReport>;

// 시간대 4칸 (새벽 0-6, 오전 6-12, 오후 12-18, 저녁 18-24)
export function byHour(hours: { t: number; w: boolean }[]) {
  const b = [0, 1, 2, 3].map(() => ({ n: 0, w: 0 }));
  for (const h of hours) {
    const i = Math.floor(new Date(h.t).getHours() / 6);
    b[i].n++;
    if (h.w) b[i].w++;
  }
  const out = b.map((x) => ({ ...x, rate: x.n ? (x.w / x.n) * 100 : null }));
  const usable = out.map((x, i) => ({ ...x, i })).filter((x) => x.n >= MIN);
  const best = usable.length >= 2 ? usable.reduce((a, c) => (c.rate! > a.rate! ? c : a)) : null;
  const worst = usable.length >= 2 ? usable.reduce((a, c) => (c.rate! < a.rate! ? c : a)) : null;
  return { buckets: out, best: best && best.rate! >= 50 ? best.i : null, worst: worst && worst.rate! < BAD && worst.i !== best?.i ? worst.i : null };
}
