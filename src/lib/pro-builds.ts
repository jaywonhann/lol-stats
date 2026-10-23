// 프로 선수·챌린저 상위 랭커의 최근 솔로랭크 빌드 (scripts/pro-builds.mjs 가 pro-data 브랜치에 올림)
import type { Server } from "./lanes";

export type Style = { cs: number; gold: number; dmg: number; vision: number; kp: number; deaths: number };
export const STYLE_KEYS = ["cs", "gold", "dmg", "vision", "kp", "deaths"] as const;

export type ProBuild = {
  m: string;
  s: Server;
  who: string;
  label: string;
  kind: "pro" | "streamer" | "challenger";
  champ: number;
  lane: string | null;
  win: boolean;
  kda: [number, number, number];
  st?: Style;
  at: number;
  dur: number;
  core: string[];
  boots: string | null;
  start: string[];
  runes: { pri: number; sec: number; perks: number[] };
  spells: number[];
};

export async function proBuilds(champKey: string, lane?: string, n = 12): Promise<{ list: ProBuild[]; updatedAt: string | null }> {
  try {
    const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
      next: { revalidate: 600 },
    });
    if (!res.ok) return { list: [], updatedAt: null };
    const data = (await res.json()) as { builds: ProBuild[]; updatedAt?: string };
    const mine = data.builds.filter((b) => String(b.champ) === champKey && b.core.length > 0);
    // 프로·유명인 게임을 먼저, 그다음 같은 라인, 최신 순
    const rank = (b: ProBuild) => (b.kind === "challenger" ? 1 : 0) * 2 + (lane && b.lane !== lane ? 1 : 0);
    mine.sort((a, b) => rank(a) - rank(b) || b.at - a.at);
    return { list: mine.slice(0, n), updatedAt: data.updatedAt ?? null };
  } catch {
    return { list: [], updatedAt: null };
  }
}

// 최근 며칠 동안 프로·스트리머·챌린저가 한 게임 (선수당 가장 최근 1판). 지금 게임 중인 사람을 못 찾을 때도 보여줄 수 있어요.
export async function recentProGames(days = 7, n = 30) {
  try {
    const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { builds: ProBuild[] };
    const since = Date.now() - days * 24 * 3_600_000;
    const latest = new Map<string, ProBuild>();
    for (const b of data.builds) {
      if (b.at < since) continue;
      const k = `${b.s}|${b.who}`;
      const old = latest.get(k);
      if (!old || b.at > old.at) latest.set(k, b);
    }
    // 프로·스트리머를 먼저, 그다음 챌린저, 각각 최신 순
    return [...latest.values()]
      .sort((a, b) => (a.kind === "challenger" ? 1 : 0) - (b.kind === "challenger" ? 1 : 0) || b.at - a.at)
      .slice(0, n);
  } catch {
    return [];
  }
}

export type ProStyle = { who: string; s: Server; label: string; kind: ProBuild["kind"]; lane: string | null; n: number; avg: Style };

// 프로·스트리머별 평균 플레이 스타일 (스타일 값이 있는 게임 3판 이상)
export async function proStyles(): Promise<ProStyle[]> {
  try {
    const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { builds: ProBuild[] };
    const by = new Map<string, ProBuild[]>();
    for (const b of data.builds) {
      if (!b.st || b.kind === "challenger") continue;
      const k = `${b.s}|${b.who}`;
      by.set(k, [...(by.get(k) ?? []), b]);
    }
    const out: ProStyle[] = [];
    for (const gs of by.values()) {
      if (gs.length < 3) continue;
      const lanes = new Map<string | null, number>();
      for (const g of gs) lanes.set(g.lane, (lanes.get(g.lane) ?? 0) + 1);
      const lane = [...lanes].sort((a, b) => b[1] - a[1])[0][0];
      const mine = gs.filter((g) => g.lane === lane);
      const avg = Object.fromEntries(
        STYLE_KEYS.map((k) => [k, mine.reduce((a, g) => a + g.st![k], 0) / mine.length]),
      ) as Style;
      out.push({ who: gs[0].who, s: gs[0].s, label: gs[0].label, kind: gs[0].kind, lane, n: mine.length, avg });
    }
    return out;
  } catch {
    return [];
  }
}

// 같은 라인 프로들 사이에서의 상대 위치(표준편차 단위)로 거리를 재서 가장 닮은 순으로 돌려줘요
export function similarPros(me: Style, lane: string | null, pros: ProStyle[], excludeWho?: string, n = 3) {
  const pool = pros.filter((p) => p.lane === lane);
  if (pool.length < 5) return null;
  const mean = {} as Style;
  const sd = {} as Style;
  for (const k of STYLE_KEYS) {
    const m = pool.reduce((a, p) => a + p.avg[k], 0) / pool.length;
    mean[k] = m;
    sd[k] = Math.sqrt(pool.reduce((a, p) => a + (p.avg[k] - m) ** 2, 0) / pool.length) || 1;
  }
  const z = (st: Style) => STYLE_KEYS.map((k) => (st[k] - mean[k]) / sd[k]);
  const zm = z(me);
  const ranked = pool
    .filter((p) => p.who.toLowerCase() !== (excludeWho ?? "").toLowerCase())
    .map((p) => {
      const d = Math.sqrt(z(p.avg).reduce((a, v, i) => a + (v - zm[i]) ** 2, 0) / STYLE_KEYS.length);
      return { pro: p, sim: Math.round(100 / (1 + d)) };
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, n);
  const emphasis = (st: Style) =>
    STYLE_KEYS.map((k) => ({ k, z: ((st[k] - mean[k]) / sd[k]) * (k === "deaths" ? -1 : 1) })).sort((a, b) => b.z - a.z);
  return { ranked, emphasis, poolSize: pool.length };
}
