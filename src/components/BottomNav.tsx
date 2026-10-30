"use client";
// 폰 화면 하단 탭 메뉴: 자주 쓰는 5곳은 한 번에, 나머지는 "더보기"에 모아 둡니다
import Link from "next/link";
import { usePathname } from "next/navigation";

const T = {
  ko: { home: "홈", tier: "티어", summoner: "전적", ranking: "랭킹", more: "더보기", champions: "챔피언", matchup: "상성 비교", items: "아이템 통계", trends: "트렌드", meta: "메타", pros: "프로 클립", predict: "승률 예측", tools: "도구", community: "커뮤니티", faq: "FAQ" },
  en: { home: "Home", tier: "Tier", summoner: "Search", ranking: "Ladder", more: "More", champions: "Champions", matchup: "Matchups", items: "Item stats", trends: "Trends", meta: "Meta", pros: "Pro clips", predict: "Predict", tools: "Tools", community: "Community", faq: "FAQ" },
};
const MAIN = [
  { href: "/", key: "home", icon: "🏠" },
  { href: "/tier", key: "tier", icon: "🏆" },
  { href: "/summoner", key: "summoner", icon: "🔍" },
  { href: "/ranking", key: "ranking", icon: "📊" },
] as const;
const MORE = ["champions", "matchup", "items", "trends", "meta", "pros", "predict", "tools", "community", "faq"] as const;

export default function BottomNav({ lang }: { lang: "ko" | "en" }) {
  const path = usePathname();
  const t = T[lang];
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const cls = (a: boolean) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${a ? "font-bold text-accent" : "text-muted"}`;
  return (
    <nav
      aria-label="menu"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {MAIN.map((m) => (
        <Link key={m.href} href={m.href} className={cls(on(m.href))}>
          <span aria-hidden className="text-lg leading-none">{m.icon}</span>
          {t[m.key]}
        </Link>
      ))}
      <details className="group relative flex flex-1">
        <summary className={`${cls(false)} w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <span aria-hidden className="text-lg leading-none">☰</span>
          {t.more}
        </summary>
        <ul className="absolute bottom-full right-2 mb-2 w-44 rounded-lg border border-line bg-panel p-1 shadow-lg">
          {MORE.map((k) => (
            <li key={k}>
              <Link href={`/${k}`} className="block rounded px-3 py-2 text-sm hover:bg-panel-2">
                {t[k]}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
