import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    // 소환사·멀티서치 조회 주소는 로봇이 긁으면 Riot 조회 한도를 써 버려서 막아요 (/summoner 첫 화면은 열어 둬요)
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/promo", "/app", "/summoner?", "/multi?", "/__"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
