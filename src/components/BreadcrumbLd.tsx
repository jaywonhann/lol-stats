import { SITE } from "@/lib/site";

// 검색 결과에 주소 대신 "livelol.stats › 상성 › 야스오 vs 요네" 같은 경로가 보이게 하는 표시 (화면에는 안 보여요)
export default function BreadcrumbLd({ items }: { items: { name: string; path: string }[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "livelol.stats", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />;
}
