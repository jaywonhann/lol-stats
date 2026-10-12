import type { Metadata } from "next";
import Link from "next/link";
import { getPatches } from "@/lib/ddragon";
import { statsSource } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";
import { dict } from "@/lib/i18n";
import ServerSelect from "@/components/ServerSelect";
import LangSelect from "@/components/LangSelect";
import { LiveBadge } from "@/components/LivePanel";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLang());
  return {
    title: { default: t.siteTitle, template: "%s - livelol.stats" },
    description: t.siteDescription,
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
        <header className="border-b border-line bg-panel">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap px-4 py-3 sm:gap-x-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              live<span className="text-accent">lol</span>.stats
            </Link>
            <LiveBadge />
            <Link href="/tier" className="text-sm text-muted hover:text-text">
              {t.nav.tier}
            </Link>
            <Link href="/trends" className="text-sm text-muted hover:text-text">
              {t.nav.trends}
            </Link>
            <Link href="/meta" className="text-sm text-muted hover:text-text">
              {t.nav.meta}
            </Link>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <ServerSelect value={server} lang={lang} />
              <LangSelect value={lang} />
            </div>
          </nav>
        </header>
        {source === "mock" && (
          <div className="border-b border-line bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
            {t.mockBanner}
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-12 border-t border-line px-4 py-6 text-center text-xs text-muted">
          livelol.stats isn&apos;t endorsed by Riot Games and doesn&apos;t reflect
          the views or opinions of Riot Games or anyone officially involved in
          producing or managing Riot Games properties. Riot Games, and all
          associated properties are trademarks or registered trademarks of Riot
          Games, Inc.
        </footer>
      </body>
    </html>
  );
}
