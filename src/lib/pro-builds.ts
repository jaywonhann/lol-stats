// 프로 선수·챌린저 상위 랭커의 최근 솔로랭크 빌드 (scripts/pro-builds.mjs 가 pro-data 브랜치에 올림)
import type { Server } from "./lanes";

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
