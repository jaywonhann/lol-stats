import type { Metadata } from "next";
import Link from "next/link";
import { getPatches } from "@/lib/ddragon";
import { statsSource } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";
import { dict } from "@/lib/i18n";
import ServerSelect from "@/components/ServerSelect";
import LangSelect from "@/components/LangSelect";
import { LiveBadge } from "@/components/LivePanel";
import { ADSENSE_CLIENT } from "@/lib/ads";
import AdSlot from "@/components/AdSlot";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLang());
  return {
    title: { default: t.siteTitle, template: "%s - livelol.stats" },
    description: t.siteDescription,
    other: { "google-adsense-account": ADSENSE_CLIENT },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [server, lang] = await Promise.all([getServer(), getLang()]);
  const t = dict(lang);
  const source = await getPatches()
    .then((p) => statsSource(p, { server, rank: "all" }).source)
    .catch(() => "mock" as const);
  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        <header className="z-30 sm:sticky sm:top-0 border-b border-line bg-panel/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap px-4 py-3 sm:gap-x-6">
            <Link href="/" className="nav-logo text-xl font-extrabold tracking-tight">
              live<span className="text-accent">lol</span>.stats
            </Link>
            <LiveBadge />
            <Link href="/tier" className="nav-link">
              {t.nav.tier}
            </Link>
            <Link href="/trends" className="nav-link">
              {t.nav.trends}
            </Link>
            <Link href="/meta" className="nav-link">
              {t.nav.meta}
            </Link>
            <Link href="/summoner" className="nav-link">
              {t.nav.summoner}
            </Link>
            <Link href="/pros" className="nav-link">
              {lang === "ko" ? "프로 핫 클립" : "Hot pro clips"}
            </Link>
            <Link href="/predict" className="nav-link">
              {lang === "ko" ? "승률 예측" : "Predict"}
            </Link>
            <Link href="/tools" className="nav-link">
              {lang === "ko" ? "도구" : "Tools"}
            </Link>
            <Link href="/faq" className="nav-link">
              {t.nav.faq}
            </Link>
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
        <Script
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <div className="relative">
          <div className="mx-auto flex max-w-6xl justify-center px-4 pt-4">
            <AdSlot kind="banner" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />
          </div>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <div className="mx-auto flex max-w-6xl justify-center px-4">
            <AdSlot kind="banner" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />
          </div>
        </div>
        <footer className="mt-12 border-t border-line px-4 py-6 text-center text-xs text-muted">
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
        <Analytics />
      </body>
    </html>
  );
}
