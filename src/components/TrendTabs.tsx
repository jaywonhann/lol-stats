import Link from "next/link";

// 트렌드와 메타는 메뉴 하나로 합치고, 페이지 위 탭으로 오가요
export default function TrendTabs({ active, lang }: { active: "trends" | "meta"; lang: "ko" | "en" }) {
  const tabs = [
    { id: "trends", href: "/trends", label: lang === "ko" ? "패치별 변화" : "By patch" },
    { id: "meta", href: "/meta", label: lang === "ko" ? "최근 3일 변화" : "Last 3 days" },
  ] as const;
  return (
    <div className="flex gap-2" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={t.id === active}
          className={`rounded-full px-3 py-1.5 text-sm ${t.id === active ? "bg-accent font-semibold text-bg" : "bg-panel-2 text-muted hover:text-text"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
