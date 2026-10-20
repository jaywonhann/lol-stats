// 지금 게임 중인 전체 플레이어 수 추정.
// Riot은 접속자 수를 공개하지 않아서, GitHub Actions(live-history.yml)가 10분마다 "분당 새로 시작되는 게임 수"를
// 게임 ID에서 구해 평균 게임 시간과 10명을 곱해 기록해요. 이 API는 그 최신 기록을 돌려줍니다.
import { NextResponse } from "next/server";
import { parseServer } from "@/lib/lanes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const server = parseServer(new URL(req.url).searchParams.get("server") ?? undefined);
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/jaywonhann/lol-stats/live-data/${server}.json`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return NextResponse.json({ available: false, reason: "no-data" });
    const data = (await res.json()) as {
      points?: { at: string; estimate: number; total: number; v?: number }[];
    };
    const last = (data.points ?? []).filter((p) => p.v === 2).at(-1);
    // 40분 넘게 새 기록이 없으면 오래된 숫자라 보여주지 않아요
    if (!last || Date.now() - new Date(last.at).getTime() > 40 * 60_000)
      return NextResponse.json({ available: false, reason: "stale" });
    return NextResponse.json(
      { available: true, server, total: 0, estimate: last.estimate, at: last.at },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } },
    );
  } catch {
    return NextResponse.json({ available: false, reason: "error" });
  }
}
