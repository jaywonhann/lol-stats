import Link from "next/link";
import LivePanel from "@/components/LivePanel";
import LiveChampions from "@/components/LiveChampions";
import VideoCard from "@/components/VideoCard";
import ChampionSearch from "@/components/ChampionSearch";
import SummonerSearch from "@/components/SummonerSearch";
import { Icon, Panel, TierBadge, WinRate } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { ddLocale, dict, numLocale, type Lang } from "@/lib/i18n";
import { LANES, laneLabel, serverLabel } from "@/lib/lanes";
import { boards, movers } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";
import { hotBuildVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lang = await getLang();
  const t = dict(lang);
  const other: Lang = lang === "ko" ? "en" : "ko";
  const [{ version, champions }, altChampions, patches, server, videos] =
    await Promise.all([
      getChampions(ddLocale(lang)),
      // 검색은 다른 언어 이름으로도 되게 (실패하면 무시)
      getChampions(ddLocale(other))
        .then((r) => r.champions)
        .catch(() => []),
      getPatches(),
      getServer(),
      hotBuildVideos(lang),
    ]);
  const nf = new Intl.NumberFormat(numLocale(lang), { notation: "compact" });
  const altName = new Map(altChampions.map((c) => [c.id, c.name]));
  const filter = { server, rank: "all" as const };
  // 새 패치에 아직 게임이 모자라면, 데이터가 있는 가장 최근 패치를 표시
  const shown = boards(champions, "mid", filter, patches).patches;
  const patch = shown[shown.length - 1] ?? patches[patches.length - 1];
  const top5 = (lane: (typeof LANES)[number]["id"]) => {
    const b = boards(champions, lane, filter, patches).boards;
    return b[b.length - 1].slice(0, 5);
  };
  const moves = LANES.map((l) =>
    movers(champions, l.id, filter, patches, 3),
  );
  const rising = moves
    .flatMap((m) => m.rising)
    .sort((a, b) => b.stat.scoreChange! - a.stat.scoreChange!)
    .slice(0, 5);
  const falling = moves
    .flatMap((m) => m.falling)
    .sort((a, b) => a.stat.scoreChange! - b.stat.scoreChange!)
    .slice(0, 5);

  const picks = LANES.map((lane) => ({ lane: lane.id, rows: top5(lane.id) }));
  // 히어로 배경: 라인별 1위 중 승률이 가장 높은 챔피언
  const featured = picks
    .filter((p) => p.rows.length > 0)
    .map((p) => ({ lane: p.lane, s: p.rows[0] }))
    .sort((a, b) => b.s.winRate - a.s.winRate)[0];
  const quick = [
    { href: "/tier", label: t.nav.tier },
    { href: "/meta", label: t.nav.meta },
    { href: "/trends", label: t.nav.trends },
    { href: "/summoner", label: t.nav.summoner },
  ];

  return (
    <div className="space-y-10">
      <section className="fade-up relative -mx-4 overflow-hidden rounded-none border-line bg-panel px-4 py-12 sm:mx-0 sm:rounded-2xl sm:border sm:px-10 sm:py-14">
        {featured && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.splash(featured.s.champion.id)}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover object-[70%_20%] opacity-35 sm:w-3/4"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/30" />
          </>
        )}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative max-w-xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            live<span className="text-accent">lol</span>.stats
          </h1>
          <p className="mt-3 text-lg font-semibold sm:text-xl">{t.heroTagline}</p>
          <p className="mt-1 text-sm text-muted">
            {t.homeSubtitle(serverLabel(server, lang), patch)}
          </p>
          <div className="mt-6">
            <SummonerSearch lang={lang} server={server} large />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="rounded-full border border-line bg-panel-2/70 px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-text"
              >
                {q.label}
              </Link>
            ))}
          </div>
          {featured && (
            <Link
              href={`/champions/${featured.s.champion.id}?lane=${featured.lane}`}
              className="mt-6 inline-flex items-center gap-2 text-xs text-muted hover:text-accent"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {t.heroFeatured(featured.s.champion.name, laneLabel(featured.lane, lang))}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </section>

      <div className="fade-up" style={{ animationDelay: "80ms" }}>
        <LivePanel server={server} lang={lang} hero />
      </div>

      <div className="fade-up" style={{ animationDelay: "120ms" }}>
        <LiveChampions server={server} lang={lang} champions={champions} version={version} />
      </div>

      <section className="fade-up" style={{ animationDelay: "160ms" }}>
        <SectionTitle title={t.bestPicksTitle} href="/tier" link={t.viewAll} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {picks.map(({ lane, rows }) => (
            <div key={lane} className="lift rounded-xl border border-line bg-panel p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{laneLabel(lane, lang)}</h3>
                <Link href={`/tier?lane=${lane}`} className="text-xs text-muted hover:text-accent">
                  {t.viewAll}
                </Link>
              </div>
              <ol>
                {rows.map((s, i) => (
                  <li key={s.champion.id}>
                    <Link
                      href={`/champions/${s.champion.id}?lane=${lane}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-panel-2"
                    >
                      <span className="w-3 text-center text-xs tabular-nums text-muted">{i + 1}</span>
                      <Icon src={img.champion(version, s.champion.image.full)} alt={s.champion.name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{s.champion.name}</span>
                        <span className="block text-xs tabular-nums"><WinRate value={s.winRate} /></span>
                      </span>
                      <TierBadge tier={s.tier} lang={lang} />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {(rising.length > 0 || falling.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { title: t.risingOnPatch(patch), rows: rising },
            { title: t.fallingOnPatch(patch), rows: falling },
          ].map((box) => (
            <Panel key={box.title} title={box.title}>
              <ul className="space-y-2">
                {box.rows.map(({ stat, spark }) => (
                  <li key={stat.champion.id + stat.lane}>
                    <Link
                      href={`/champions/${stat.champion.id}?lane=${stat.lane}`}
                      className="flex items-center gap-3 hover:text-accent"
                    >
                      <Icon
                        src={img.champion(version, stat.champion.image.full)}
                        alt={stat.champion.name}
                        size={28}
                      />
                      <span className="flex-1 truncate text-sm">
                        {stat.champion.name}{" "}
                        <span className="text-xs text-muted">
                          {laneLabel(stat.lane, lang)}
                        </span>
                      </span>
                      <Sparkline values={spark} />
                      <ScoreDelta value={stat.scoreChange!} />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/trends"
                className="mt-3 block text-xs text-accent hover:underline"
              >
                {t.viewAllTrends}
              </Link>
            </Panel>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <section className="fade-up" style={{ animationDelay: "240ms" }}>
          <SectionTitle title={t.hotBuildVideos} note={t.hotBuildNote} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                id={v.id}
                title={v.title}
                meta={[v.channel, v.views !== null ? t.views(nf.format(v.views)) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title={t.championSearch} />
        <Panel>
        <ChampionSearch
          lang={lang}
          champions={champions.map((c) => ({
            id: c.id,
            name: c.name,
            alt: altName.get(c.id),
            icon: img.champion(version, c.image.full),
          }))}
        />
        </Panel>
      </section>
    </div>
  );
}

function SectionTitle({ title, note, href, link }: { title: string; note?: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      {href && link && (
        <Link href={href} className="shrink-0 text-xs text-accent hover:underline">
          {link}
        </Link>
      )}
    </div>
  );
}

function ScoreDelta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`w-14 text-right text-xs font-semibold ${up ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(value).toFixed(1)}
    </span>
  );
}
