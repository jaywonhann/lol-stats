// "잘하고 있다"는 느낌을 주는 성과 요약과 짧은 개선 포인트 (사용자 본인의 최근 게임 기록만 사용)
import { AXES, type Axis, type ScoreReport } from "./score";

export const HEX = [...AXES, "steady"] as const;
export type HexKey = (typeof HEX)[number];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export type Badge = { id: string; value?: number | string; champ?: string };
export type Tip = { axis: HexKey; withWr: number; withoutWr: number; nWith: number; nWithout: number } | { axis: HexKey; plain: true };

export type Growth = {
  hex: Record<HexKey, number>; // 0~100, 50 = 평균
  badges: Badge[];
  weakest: HexKey;
  strongest: HexKey;
  tip: Tip;
};

export function growth(r: ScoreReport): Growth {
  const g = r.games; // 최신 → 오래된 순
  const sd = Math.sqrt(mean(g.map((x) => (x.inbun - r.avgInbun) ** 2)));
  const hex = { ...r.radar, steady: Math.round(clamp(100 - sd * 120, 5, 100)) } as Record<HexKey, number>;
  const keys = [...HEX];
  const weakest = keys.reduce((a, b) => (hex[b] < hex[a] ? b : a));
  const strongest = keys.reduce((a, b) => (hex[b] > hex[a] ? b : a));

  const badges: Badge[] = [];
  let streak = 0;
  for (const x of g) {
    if (!x.win) break;
    streak++;
  }
  if (streak >= 2) badges.push({ id: "streak", value: streak });
  const best = g.reduce((a, b) => (b.inbun > a.inbun ? b : a));
  if (best.inbun >= 1.2) badges.push({ id: "best", value: best.inbun.toFixed(2), champ: best.championName });
  const wins = g.filter((x) => x.win).length;
  if (g.length >= 5 && wins / g.length >= 0.55) badges.push({ id: "winning", value: `${wins}/${g.length}` });
  if (g.length >= 10) {
    const half = Math.floor(g.length / 2);
    const recent = mean(g.slice(0, half).map((x) => x.inbun));
    const before = mean(g.slice(half).map((x) => x.inbun));
    if (recent - before >= 0.05) badges.push({ id: "up", value: `+${Math.round(((recent - before) / before) * 100)}%` });
  }
  if (r.carriedLosses > 0) badges.push({ id: "carried", value: r.carriedLosses });
  const strongAxes = g.filter((x) => x.inbun >= 1.1).length;
  if (strongAxes >= Math.ceil(g.length / 2)) badges.push({ id: "solid", value: `${strongAxes}/${g.length}` });

  // 개선 포인트: 가장 약한 칸을 챙긴 판과 아닌 판의 승률 차이 (내 기록 기준)
  let tip: Tip = { axis: weakest, plain: true };
  if (weakest !== "steady") {
    const a = weakest as Axis;
    const hi = g.filter((x) => x.axes[a] >= 1);
    const lo = g.filter((x) => x.axes[a] < 1);
    if (hi.length >= 3 && lo.length >= 3) {
      const wr = (xs: typeof g) => Math.round((xs.filter((x) => x.win).length / xs.length) * 100);
      const w = wr(hi), wo = wr(lo);
      if (w > wo) tip = { axis: weakest, withWr: w, withoutWr: wo, nWith: hi.length, nWithout: lo.length };
    }
  }
  return { hex, badges, weakest, strongest, tip };
}
