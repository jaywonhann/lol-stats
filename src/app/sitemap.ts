import type { MetadataRoute } from "next";
import { getChampions } from "@/lib/ddragon";
import { loadRealData, realLanes } from "@/lib/real";
import { topMatchups } from "@/lib/matchups";
import { loadAram, MIN_ARAM_GAMES } from "@/lib/aram";

export const revalidate = 86400;

const SITE = "https://lollive.vercel.app";
const PAGES = ["", "/tier", "/trends", "/meta", "/champions", "/matchup", "/items", "/summoner", "/ranking", "/aram", "/duo", "/pros", "/predict", "/tools", "/community", "/faq"];

// 실제 데이터에서 표본이 많은 상성 조합 상위 N개 ("야스오 vs 요네" 같은 검색 유입용)
function matchupUrls(byKey: Map<string, string>, limit = 400): string[] {
  return topMatchups()
    .filter((m) => byKey.has(m.a) && byKey.has(m.b))
    .slice(0, limit)
    .map((m) => `a=${byKey.get(m.a)}&b=${byKey.get(m.b)}&lane=${m.lane}`);
}

// 주 라인 외에 실제 데이터가 충분한 다른 라인 ("야스오 탑 빌드" 같은 검색용)
function offLanes(champions: Parameters<typeof realLanes>[1][]): string[] {
  const out = new Set<string>();
  for (const server of ["kr", "na1", "euw1"] as const) {
    const real = loadRealData({ server, rank: "all" });
    const patch = [...real.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    if (!patch) continue;
    for (const c of champions) for (const l of realLanes(real.get(patch)!, c).slice(1)) out.add(`${c.id}?lane=${l}`);
  }
  return [...out];
}

// 검색엔진용: 주요 페이지 + 모든 챔피언 페이지 + 인기 상성 조합
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = PAGES.map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 }));
  try {
    const { champions } = await getChampions();
    const aram = loadAram();
    return [
      ...pages,
      ...champions.map((c) => ({ url: `${SITE}/champions/${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      ...champions
        .filter((c) => Math.max(aram.champs[`mayhem:${c.key}`]?.games ?? 0, aram.champs[`aram:${c.key}`]?.games ?? 0) >= MIN_ARAM_GAMES)
        .map((c) => ({ url: `${SITE}/aram/${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      ...offLanes(champions).map((q) => ({ url: `${SITE}/champions/${q}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.55 })),
      ...matchupUrls(new Map(champions.map((c) => [c.key, c.id]))).map((q) => ({
        url: `${SITE}/matchup?${q.replaceAll("&", "&amp;")}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    return pages;
  }
}
