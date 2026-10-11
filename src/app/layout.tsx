import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "협곡지표 - 롤 챔피언 통계", template: "%s - 협곡지표" },
  description: "리그 오브 레전드 챔피언 티어, 빌드, 룬, 카운터 통계",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-panel">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              <span className="text-accent">협곡</span>지표
            </Link>
            <Link href="/tier" className="text-sm text-muted hover:text-text">
              티어 리스트
            </Link>
            <Link href="/trends" className="text-sm text-muted hover:text-text">
              패치 트렌드
            </Link>
          </nav>
        </header>
        <div className="border-b border-line bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
          지금 보이는 승률·픽률·빌드 통계는 예시용 목업 데이터예요. 챔피언·아이템·룬 정보는 실제 게임 데이터입니다.
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-12 border-t border-line px-4 py-6 text-center text-xs text-muted">
          협곡지표 isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or
          anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </body>
    </html>
  );
}
