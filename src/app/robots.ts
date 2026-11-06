import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/promo", "/app"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
