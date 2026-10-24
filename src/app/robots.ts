import type { MetadataRoute } from "next";

const SITE = "https://lollive.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/promo", "/app"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
