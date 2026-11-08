import { SITE } from "@/lib/site";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { hasRealData } from "@/lib/real";
import { getLang, getServer, homeLangLinks, langAlternates } from "@/lib/server";
import { dict } from "@/lib/i18n";
import ServerSelect from "@/components/ServerSelect";
import LangSelect from "@/components/LangSelect";
import { LiveBadge } from "@/components/LivePanel";
import { ADSENSE_CLIENT } from "@/lib/ads";
import AdSlot from "@/components/AdSlot";
import BottomNav from "@/components/BottomNav";
import SlashSearch from "@/components/SlashSearch";
import NavProgress from "@/components/NavProgress";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { token as communityOn } from "@/lib/community";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLang());
  return {
    metadataBase: new URL(SITE),
    alternates: await langAlternates("./"),
    title: { default: t.siteTitle, template: "%s - livelol.stats" },
    description: t.siteDescription,
    manifest: "/manifest.webmanifest",
    icons: { apple: "/apple-touch-icon.png" },
    verification: { google: "_-6PArOHrYvTVP-g36tgO22K_2iXB0nqyiOkYl1Ypqk" },
    other: { "google-adsense-account": ADSENSE_CLIENT },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [server, lang, home] = await Promise.all([getServer(), getLang(), homeLangLinks(SITE)]);
  const t = dict(lang);
  const source = hasRealData(server) ? ("real" as const) : ("mock" as const);
  return (
    <html lang={lang}>
      <head>
        {home && (
          <>
            <link rel="canonical" href={home.canonical} />
            <link rel="alternate" hrefLang="en" href={home.en} />
            <link rel="alternate" hrefLang="ko" href={home.ko} />
            <link rel="alternate" hrefLang="x-default" href={home.en} />
          </>
        )}
        {/* 한글·영문 모두 같은 인상으로 보이도록 Pretendard 를 실제로 불러와요 (필요한 글자만 나눠 받음) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-screen antialiased">
        <Suspense>
          <NavProgress />
        </Suspense>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
        >
          {lang === "ko" ? "본문으로 건너뛰기" : "Skip to content"}
        </a>
        <header className="site-header z-30 sm:sticky sm:top-0">
          <nav className="mx-auto flex min-h-[72px] max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap px-4 py-3 sm:gap-x-7">
            <Link href="/" className="nav-logo flex items-center text-2xl font-black tracking-tight sm:text-[1.7rem]">
              <img src="/icon-192.png" alt="" width={44} height={44} className="mr-2.5 h-10 w-10 sm:h-11 sm:w-11" />
              live<span className="text-accent">lol</span>.stats
            </Link>
            <LiveBadge />
            <Link href="/tier" className="nav-link">
              {t.nav.tier}
            </Link>
            <Link href="/trends" className="nav-link">
              {t.nav.trends}
            </Link>
            <Link href="/summoner" className="nav-link">
              {t.nav.summoner}
            </Link>
            <Link href="/ranking" className="nav-link">
              {lang === "ko" ? "랭킹" : "Ladder"}
            </Link>
            <Link href="/aram" className="nav-link">
              {lang === "ko" ? "칼바람" : "ARAM"}
            </Link>
            <details className="nav-more relative hidden sm:block">
              <summary className="nav-link cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {lang === "ko" ? "더보기 ▾" : "More ▾"}
              </summary>
              <div className="absolute left-0 top-full z-40 mt-2 flex w-44 flex-col rounded-lg border border-line bg-panel p-1 shadow-lg">
                <Link href="/champions" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {lang === "ko" ? "챔피언 목록" : "All champions"}
                </Link>
                <Link href="/matchup" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {lang === "ko" ? "상성 비교" : "Matchup lookup"}
                </Link>
                <Link href="/bans" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {lang === "ko" ? "밴 추천" : "Who to ban"}
                </Link>
                <Link href="/duo" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {lang === "ko" ? "바텀 듀오 조합" : "Bot duo tier list"}
                </Link>
                <Link href="/items" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {lang === "ko" ? "아이템 통계" : "Item stats"}
                </Link>
                {/* 글 저장소 토큰(FEEDBACK_TOKEN)이 서버에 없으면 커뮤니티가 안 열려서 메뉴에서 숨겨요 */}
                {communityOn() && (
                  <Link href="/community" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                    {lang === "ko" ? "커뮤니티" : "Community"}
                  </Link>
                )}
                <Link href="/faq" className="rounded px-3 py-2 text-sm hover:bg-panel-2">
                  {t.nav.faq}
                </Link>
              </div>
            </details>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <ServerSelect value={server} lang={lang} />
              <LangSelect value={lang} />
            </div>
          </nav>
        </header>
        {source === "mock" && (
          <div className="mock-banner border-b border-line bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
            {t.mockBanner}
          </div>
        )}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <div className="relative">
          <div className="mx-auto flex max-w-6xl justify-center px-4 pt-4">
            <AdSlot kind="banner" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />
          </div>
          <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <div className="mx-auto flex max-w-6xl justify-center px-4">
            <AdSlot kind="banner" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />
          </div>
        </div>
        <footer className="mt-12 border-t border-line px-4 pb-24 pt-6 sm:pb-6 text-center text-xs text-muted">
          <p className="mb-3 text-sm">
            <Link href="/faq" className="hover:text-text">FAQ</Link>
            {" · "}
            <Link href="/privacy" className="hover:text-text">
              {lang === "ko" ? "개인정보처리방침" : "Privacy"}
            </Link>
            {" · "}
            <Link href="/faq#feedback" className="font-semibold text-accent hover:underline">
              {t.footerFeedback}
            </Link>
          </p>
          livelol.stats isn&apos;t endorsed by Riot Games and doesn&apos;t reflect
          the views or opinions of Riot Games or anyone officially involved in
          producing or managing Riot Games properties. Riot Games, and all
          associated properties are trademarks or registered trademarks of Riot
          Games, Inc.
        </footer>
        <SlashSearch />
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "livelol.stats",
              url: SITE,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE}/summoner?id={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <BottomNav lang={lang} community={!!communityOn()} />
      </body>
    </html>
  );
}
