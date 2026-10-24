import type { MetadataRoute } from "next";
import { getChampions } from "@/lib/ddragon";

export const revalidate = 86400;

const SITE = "https://lollive.vercel.app";
const PAGES = ["", "/tier", "/trends", "/meta", "/summoner", "/ranking", "/pros", "/predict", "/tools", "/community", "/faq"];

// 검색엔진용: 주요 페이지 + 모든 챔피언 페이지
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = PAGES.map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 }));
  try {
    const { champions } = await getChampions();
    return [
      ...pages,
      ...champions.map((c) => ({ url: `${SITE}/champions/${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
    ];
  } catch {
    return pages;
  }
}
