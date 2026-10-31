import type { Metadata } from "next";
import Link from "next/link";
import ProsLive from "@/components/ProsLive";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import VideoCard from "@/components/VideoCard";
import { recentProGames } from "@/lib/pro-builds";
import { liveStreams, recentVideos } from "@/lib/youtube";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "ko" ? "프로 핫한 클립" : "Hot pro clips" };
}

export default async function ProsPage() {
  const lang = await getLang();
  const ko = lang === "ko";
  const [{ version, champions }, recent, streams, videos] = await Promise.all([
    getChampions(ddLocale(lang)),
    recentProGames(),
    liveStreams(lang).catch(() => []),
    recentVideos(lang).catch(() => []),
  ]);
  const ytLive = `https://www.youtube.com/results?search_query=${encodeURIComponent(ko ? "리그오브레전드 라이브" : "league of legends live")}&sp=EgJAAQ%253D%253D`;
  const champs = Object.fromEntries(
    champions.map((c) => [c.key, { name: c.name, id: c.id, icon: img.champion(version, c.image.full) }]),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ko ? "프로 핫한 클립" : "Hot pro clips"}</h1>
      <p className="text-sm text-muted">
        {ko
          ? "요즘 조회수 높은 롤 영상과 지금 하는 유튜브 라이브, 그리고 프로·스트리머의 최근 전적을 모았어요."
          : "Popular League videos, live YouTube streams, and recent games from pros and streamers."}
      </p>

      {videos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">{ko ? "요즘 핫한 클립" : "Hot clips"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                id={v.id}
                title={v.title}
                meta={[v.channel, v.views !== null ? `${v.views.toLocaleString()} ${ko ? "회" : "views"}` : ""].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {streams.length > 0 && <span className="live-dot h-2 w-2 rounded-full bg-red-500" aria-hidden />}
          {ko ? "유튜브 라이브" : "YouTube live"}
        </h2>
        {streams.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {streams.map((s) => (
              <VideoCard key={s.id} id={s.id} title={s.title} meta={s.channel} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {ko ? "지금 생방송 중인 롤 채널을 찾지 못했어요." : "No live League channels found right now."}
          </p>
        )}
        <a
          href={ytLive}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          ▶ {ko ? "유튜브에서 롤 라이브 더 보기" : "More League live streams on YouTube"}
        </a>
      </section>


      <h2 className="text-lg font-bold">{ko ? "지금 게임 중인 프로" : "Pros in a game now"}</h2>
      <ProsLive champs={champs} ko={ko} />

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">{ko ? "최근 7일 프로 게임" : "Recent pro games (7 days)"}</h2>
          <p className="text-xs text-muted">
            {ko
              ? "선수마다 가장 최근에 확인된 솔로랭크 게임이에요. 지금 게임 중이 아니어도 어떤 챔피언을 했는지 볼 수 있어요."
              : "Each player's most recent ranked game we've seen. Handy even when nobody is live."}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {recent.map((b) => {
              const c = champs[String(b.champ)];
              const hours = Math.max(1, Math.round((Date.now() - b.at) / 3_600_000));
              const ago = hours < 48 ? (ko ? `${hours}시간 전` : `${hours}h ago`) : ko ? `${Math.round(hours / 24)}일 전` : `${Math.round(hours / 24)}d ago`;
              return (
                <li key={`${b.s}-${b.who}`} className="flex items-center gap-3 rounded-lg bg-panel p-3">
                  {c && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt={c.name} width={40} height={40} className="rounded-md" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/summoner?id=${encodeURIComponent(b.who)}`} className="block truncate font-semibold hover:underline">
                      {b.label}
                    </Link>
                    <span className="text-xs text-muted">
                      {c?.name} · {b.kda.join("/")} · {b.s.toUpperCase()} · {ago}
                    </span>
                  </div>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${b.label.split(" (")[0]} ${ko ? "롤" : "league of legends"}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-muted hover:text-text"
                    aria-label={ko ? "유튜브에서 찾기" : "Find on YouTube"}
                  >
                    ▶ YouTube
                  </a>
                  <span className={`shrink-0 text-sm font-bold ${b.win ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}>
                    {b.win ? (ko ? "승" : "W") : ko ? "패" : "L"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
