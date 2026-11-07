import { SITE } from "@/lib/site";
import { LANES } from "@/lib/lanes";
import type { MetadataRoute } from "next";
import { getChampions } from "@/lib/ddragon";
import { loadRealData, realLanes } from "@/lib/real";
import { topMatchups } from "@/lib/matchups";
import { loadAram, MIN_ARAM_GAMES } from "@/lib/aram";

export const revalidate = 86400;

import { token as communityOn } from "@/lib/community";

const ALL_PAGES = ["", "/tier", "/trends", "/meta", "/champions", "/matchup", "/items", "/summoner", "/ranking", "/aram?mode=mayhem", "/aram?mode=aram", "/duo", "/pros", "/predict", "/tools", "/community", "/faq"];
// 커뮤니티는 열 수 있을 때만 올려요
const PAGES = ALL_PAGES.filter((p) => p !== "/community" || communityOn());

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

type Entry = MetadataRoute.Sitemap[number];
// 모든 주소를 영어(그대로)와 한국어(?lang=ko) 두 벌로 올리고 hreflang으로 서로 이어요.
// 쿠키로만 언어를 바꾸면 검색엔진은 영어만 보게 돼서, "야스오 카운터" 같은 한글 검색에 안 걸려요.
function bilingual(list: Entry[]): MetadataRoute.Sitemap {
  return list.flatMap((e) => {
    const ko = e.url === SITE ? `${SITE}/?lang=ko` : `${e.url}${e.url.includes("?") ? "&amp;" : "?"}lang=ko`;
    const languages = { en: e.url, ko };
    return [
      { ...e, alternates: { languages } },
      { ...e, url: ko, alternates: { languages } },
    ];
  });
}

// 검색엔진용: 주요 페이지 + 모든 챔피언 페이지 + 인기 상성 조합
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return bilingual(await entries());
}

async function entries(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = PAGES.map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 }));
  // 라인별 티어표 ("탑 티어" 검색용)
  pages.push(...LANES.map((l) => ({ url: `${SITE}/tier?lane=${l.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })));
  try {
    const { champions } = await getChampions();
    const aram = loadAram();
    return [
      ...pages,
      ...champions.map((c) => ({ url: `${SITE}/champions/${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      // 칼바람·증바람은 페이지가 ?mode= 로 갈려서(canonical도 그 주소) 모드마다 따로 올려요
      ...(["mayhem", "aram"] as const).flatMap((mode) =>
        champions
          .filter((c) => (aram.champs[`${mode}:${c.key}`]?.games ?? 0) >= MIN_ARAM_GAMES)
          .map((c) => ({ url: `${SITE}/aram/${c.id}?mode=${mode}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      ),
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
