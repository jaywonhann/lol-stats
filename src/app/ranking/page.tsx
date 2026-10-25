import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { ladder, RiotError, type LadderTier } from "@/lib/riot";
import { getLang, getServer } from "@/lib/server";
import { serverLabel } from "@/lib/lanes";

export const dynamic = "force-dynamic";

const TIERS: LadderTier[] = ["challenger", "grandmaster", "master"];

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "랭킹" : "Ladder",
    description: ko ? "서버별 챌린저, 그랜드마스터, 마스터 상위 랭커 목록이에요." : "Top Challenger, Grandmaster and Master players by server.",
  };
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const [{ tier: q }, lang, server] = await Promise.all([searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const tier = TIERS.find((x) => x === q) ?? "challenger";
  const name = { challenger: ko ? "챌린저" : "Challenger", grandmaster: ko ? "그랜드마스터" : "Grandmaster", master: ko ? "마스터" : "Master" };
  let data: Awaited<ReturnType<typeof ladder>> | null = null;
  let err: RiotError["kind"] | null = null;
  try {
    data = await ladder(server, tier);
  } catch (e) {
    err = e instanceof RiotError ? e.kind : "error";
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ko ? "랭킹" : "Ladder"}</h1>
      <p className="text-sm text-muted">
        {ko
          ? `${serverLabel(server, lang)} 솔로랭크 상위권이에요. 이름을 누르면 그 사람의 최근 전적 분석을 볼 수 있어요. 서버는 위쪽에서 바꿀 수 있어요.`
          : `Top solo queue players on ${serverLabel(server, lang)}. Click a name for their recent-games analysis. Change the server at the top.`}
      </p>
      <div className="flex gap-2">
        {TIERS.map((x) => (
          <Link
            key={x}
            href={`/ranking?tier=${x}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${x === tier ? "border-accent text-accent" : "border-line text-muted hover:text-text"}`}
          >
            {name[x]}
          </Link>
        ))}
      </div>
      {data ? (
        <Panel title={`${name[tier]} · ${ko ? `${data.total.toLocaleString()}명 중 상위 ${data.rows.length}명` : `top ${data.rows.length} of ${data.total.toLocaleString()}`}`}>
          <ol className="divide-y divide-line">
            {data.rows.map((r) => {
              const games = r.wins + r.losses;
              const id = r.account ? `${r.account.gameName}#${r.account.tagLine}` : null;
              return (
                <li key={r.rank} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-8 shrink-0 text-right font-bold text-muted">{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {id ? (
                      <Link href={`/summoner?id=${encodeURIComponent(id)}`} className="hover:underline">
                        {r.account!.gameName} <span className="font-normal text-muted">#{r.account!.tagLine}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                    {r.hotStreak && <span className="ml-2 text-xs text-[var(--chart-up)]">{ko ? "🔥 연승 중" : "🔥 hot streak"}</span>}
                  </span>
                  <span className="shrink-0 font-bold">{r.leaguePoints.toLocaleString()} LP</span>
                  <span className="hidden w-28 shrink-0 text-right text-muted sm:block">
                    {r.wins}{ko ? "승" : "W"} {r.losses}{ko ? "패" : "L"} · {games ? Math.round((r.wins / games) * 100) : 0}%
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm">
            {err === "rate-limited"
              ? ko ? "요청이 몰려서 잠시 쉬는 중이에요. 1~2분 뒤에 다시 열어 주세요." : "Busy right now. Try again in a minute or two."
              : ko ? "지금은 랭킹을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요." : "Couldn't load the ladder right now. Please try again shortly."}
          </p>
        </Panel>
      )}
    </div>
  );
}
