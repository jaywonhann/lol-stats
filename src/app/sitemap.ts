import type { MetadataRoute } from "next";
import { getChampions } from "@/lib/ddragon";
import { loadRealData } from "@/lib/real";

export const revalidate = 86400;

const SITE = "https://lollive.vercel.app";
const PAGES = ["", "/tier", "/trends", "/meta", "/champions", "/matchup", "/items", "/summoner", "/ranking", "/pros", "/predict", "/tools", "/community", "/faq"];

// 실제 데이터에서 표본이 많은 상성 조합 상위 N개 ("야스오 vs 요네" 같은 검색 유입용)
function topMatchups(byKey: Map<string, string>, limit = 400): string[] {
  const counts = new Map<string, number>();
  for (const server of ["kr", "na1", "euw1"] as const) {
    const real = loadRealData({ server, rank: "all" });
    const patch = [...real.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    if (!patch) continue;
    for (const [k, v] of Object.entries(real.get(patch)!.champs)) {
      const [ck, lane] = k.split(":");
      for (const [ok, [g]] of Object.entries(v.vs)) {
        if (g < 10) continue;
        const a = byKey.get(ck);
        const b = byKey.get(ok);
        if (!a || !b) continue;
        const id = `a=${a}&b=${b}&lane=${lane}`;
        counts.set(id, (counts.get(id) ?? 0) + g);
      }
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([id]) => id);
}

// 검색엔진용: 주요 페이지 + 모든 챔피언 페이지 + 인기 상성 조합
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = PAGES.map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 }));
  try {
    const { champions } = await getChampions();
    return [
      ...pages,
      ...champions.map((c) => ({ url: `${SITE}/champions/${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      ...topMatchups(new Map(champions.map((c) => [c.key, c.id]))).map((q) => ({
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
