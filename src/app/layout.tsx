import type { Metadata } from "next";
import Link from "next/link";
import { getPatches } from "@/lib/ddragon";
import { statsSource } from "@/lib/stats";
import { getServer } from "@/lib/server";
import ServerSelect from "@/components/ServerSelect";
import { LiveBadge } from "@/components/LivePanel";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "livelol.stats - 롤 챔피언 통계", template: "%s - livelol.stats" },
  description: "리그 오브 레전드 챔피언 티어, 빌드, 룬, 카운터 통계",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const server = await getServer();
  const source = await getPatches()
    .then((p) => statsSource(p, { server, rank: "all" }).source)
    .catch(() => "mock" as const);
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-panel">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap px-4 py-3 sm:gap-x-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              live<span className="text-accent">lol</span>.stats
            </Link>
            <LiveBadge />
            <Link href="/tier" className="text-sm text-muted hover:text-text">
              티어 리스트
            </Link>
            <Link href="/trends" className="text-sm text-muted hover:text-text">
              패치 트렌드
            </Link>
            <Link href="/meta" className="text-sm text-muted hover:text-text">
              메타 차트
            </Link>
            <ServerSelect value={server} />
          </nav>
        </header>
        {source === "mock" && (
          <div className="border-b border-line bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
            이 서버는 아직 실제 게임을 모으는 중이라 지금 보이는 승률·픽률·순위는
            예시 데이터예요. 게임이 모이면 실제 통계와 빌드로 바뀌어요.
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
