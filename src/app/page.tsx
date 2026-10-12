import Link from "next/link";
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
  const patch = patches[patches.length - 1];
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

  return (
    <div className="space-y-8">
      <section className="pt-4 text-center">
        <h1 className="text-3xl font-bold">
          live<span className="text-accent">lol</span>.stats
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t.homeSubtitle(serverLabel(server, lang), patch)}
        </p>
        <div className="mx-auto mt-5 max-w-xl text-left">
          <SummonerSearch lang={lang} server={server} large />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        {LANES.map((lane) => (
          <Panel key={lane.id} title={t.bestPicks(laneLabel(lane.id, lang))}>
            <ul className="space-y-2">
              {top5(lane.id).map((s) => (
                <li key={s.champion.id}>
                  <Link
                    href={`/champions/${s.champion.id}?lane=${lane.id}`}
                    className="flex items-center gap-2 hover:text-accent"
                  >
                    <Icon
                      src={img.champion(version, s.champion.image.full)}
                      alt={s.champion.name}
                      size={28}
                    />
                    <span className="flex-1 truncate text-sm">
                      {s.champion.name}
                    </span>
                    <TierBadge tier={s.tier} lang={lang} />
                  </Link>
                  <div className="pl-9 text-xs text-muted">
                    {t.winRate} <WinRate value={s.winRate} />
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href={`/tier?lane=${lane.id}`}
              className="mt-3 block text-xs text-accent hover:underline"
            >
              {t.viewAll}
            </Link>
          </Panel>
        ))}
      </div>

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
        <Panel title={t.hotBuildVideos}>
          <p className="-mt-1 mb-3 text-xs text-muted">{t.hotBuildNote}</p>
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
        </Panel>
      )}

      <Panel title={t.championSearch}>
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
