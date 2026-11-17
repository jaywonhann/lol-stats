import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    // 소환사·멀티서치 조회 주소는 로봇이 긁으면 Riot 조회 한도를 써 버려서 막아요 (/summoner 첫 화면은 열어 둬요)
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/promo", "/app", "/summoner?", "/multi?", "/__", "/visits", "/s/"] },
      // AI 학습용·SEO 수집 로봇: 방문자를 데려오지 않고 작은 서버만 느리게 해서 막아요 (검색·답변용 로봇은 위 규칙대로 열어 둬요)
      {
        userAgent: ["meta-externalagent", "GPTBot", "CCBot", "Bytespider", "ClaudeBot", "anthropic-ai", "Amazonbot", "Diffbot", "PetalBot", "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
