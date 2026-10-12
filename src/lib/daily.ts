// 날짜별 챔피언 기록 (scripts/collect.mjs 가 data/patches/{서버}/daily.json 에 저장)
// 주식 차트처럼 날짜별 픽률·빌드 승률 흐름을 그릴 때 씁니다. 하루 표본이 적어서 3일 이동 합계로 계산합니다.
import fs from "node:fs";
import path from "node:path";
import type { Lane, Server } from "./lanes";

type Counts = Record<string, [number, number]>;
type DailyFile = {
  updatedAt: string;
  days: Record<string, { matches: number; champs: Record<string, [number, number, Counts]> }>;
};

export const WINDOW = 3;

export function loadDaily(server: Server) {
  const file = path.join(process.cwd(), "data", "patches", server, "daily.json");
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as DailyFile;
  const days = Object.keys(raw.days)
    .sort()
    .filter((d) => raw.days[d].matches > 0);
  if (days.length < 2) return null;
  return { updatedAt: raw.updatedAt, days, raw };
}

export type Daily = NonNullable<ReturnType<typeof loadDaily>>;

const roll = (arr: number[], i: number) =>
  arr.slice(Math.max(0, i - WINDOW + 1), i + 1).reduce((s, v) => s + v, 0);

export const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 챔피언·라인별 날짜별 픽률(%)
export function pickSeries(daily: Daily, key: string) {
  const { days, raw } = daily;
  const matches = days.map((d) => raw.days[d].matches);
  const games = days.map((d) => raw.days[d].champs[key]?.[0] ?? 0);
  return {
    values: days.map((_, i) => (roll(games, i) / roll(matches, i)) * 100),
    recentGames: roll(games, days.length - 1),
  };
}

export type PickMover = { championKey: string; values: number[]; change: number; recentGames: number };

// 최근 3일 픽률이 그 전 3일보다 얼마나 올랐는지/내렸는지
export function pickMovers(daily: Daily, lane: Lane, count = 6) {
  const keys = new Set<string>();
  for (const d of daily.days)
    for (const k of Object.keys(daily.raw.days[d].champs)) if (k.endsWith(`:${lane}`)) keys.add(k);
  const rows: PickMover[] = [];
  for (const key of keys) {
    const s = pickSeries(daily, key);
    if (s.recentGames < 20) continue;
    const last = s.values.length - 1;
    const before = s.values[Math.max(0, last - WINDOW)];
    rows.push({ championKey: key.split(":")[0], values: s.values, change: s.values[last] - before, recentGames: s.recentGames });
  }
  rows.sort((a, b) => b.change - a.change);
  return {
    rising: rows.filter((r) => r.change > 0).slice(0, count),
    falling: rows.filter((r) => r.change < 0).reverse().slice(0, count),
  };
}

// 챔피언 한 명의 코어템 두 개 조합별 날짜별 승률(%). 표본이 적은 날은 비워 둡니다.
export function buildSeries(daily: Daily, key: string, count = 3) {
  const { days, raw } = daily;
  const totals: Record<string, number> = {};
  for (const d of days)
    for (const [pair, [g]] of Object.entries(raw.days[d].champs[key]?.[2] ?? {})) totals[pair] = (totals[pair] ?? 0) + g;
  return Object.entries(totals)
    .filter(([, g]) => g >= 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([pair, total]) => {
      const g = days.map((d) => raw.days[d].champs[key]?.[2][pair]?.[0] ?? 0);
      const w = days.map((d) => raw.days[d].champs[key]?.[2][pair]?.[1] ?? 0);
      return {
        pair,
        total,
        values: days.map((_, i) => (roll(g, i) >= 10 ? (roll(w, i) / roll(g, i)) * 100 : null)),
      };
    });
}
