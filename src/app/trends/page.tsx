import type { Metadata } from "next";
import Link from "next/link";
import { DivergingBars, Sparkline } from "@/components/charts";
import { Icon, Panel, Tabs, TierBadge, WinRate } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import {
  LANES,
  RANKS,
  parseLane,
  parseRank,
  laneLabel,
  rankLabel,
  serverLabel,
} from "@/lib/lanes";
import { ddLocale, dict, type Lang } from "@/lib/i18n";
import type { ChampionStat } from "@/lib/mock";
import { movers } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLang()).trendsTitle };
}

type Props = { searchParams: Promise<{ lane?: string; rank?: string }> };

export default async function TrendsPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane = parseLane(params.lane);
  const rank = parseRank(params.rank);
  const lang = await getLang();
  const t = dict(lang);
  const [{ version, champions }, allPatches, server] = await Promise.all([
    getChampions(ddLocale(lang)),
    getPatches(),
    getServer(),
  ]);
  const { source, patches, rising, falling } = movers(
    champions,
    lane,
    { server, rank },
    allPatches,
    8,
  );
  const patch = patches[patches.length - 1];
  const prev = patches[patches.length - 2];
  const bars = [...rising, ...[...falling].reverse()].map(({ stat }) => ({
    label: stat.champion.name,
    value: stat.scoreChange!,
    detail: t.scoreChangeDetail(
      `${stat.scoreChange! >= 0 ? "+" : ""}${stat.scoreChange!.toFixed(1)}`,
      stat.winRate.toFixed(2),
    ),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.trendsTitle}</h1>
        <span className="text-sm text-muted">
          {prev ? t.scoreChangeRange(prev, patch) : t.patch(patch)} ·{" "}
          {t.serverName(serverLabel(server, lang))} · {rankLabel(rank, lang)} ·{" "}
          {source === "real" ? t.realGames : t.sampleData}
        </span>
      </div>
      <div className="space-y-2">
        <Tabs
          active={lane}
          items={LANES.map((l) => ({
            id: l.id,
            label: laneLabel(l.id, lang),
            href: `/trends?lane=${l.id}&rank=${rank}`,
          }))}
        />
        <Tabs
          active={rank}
          items={RANKS.map((r) => ({
            id: r.id,
            label: rankLabel(r.id, lang),
            href: `/trends?lane=${lane}&rank=${r.id}`,
          }))}
        />
      </div>

      {!prev && (
        <Panel>
          <p className="text-sm text-muted">
            {t.trendsFirstPatch}
          </p>
        </Panel>
      )}

      {prev && (
        <Panel>
          <DivergingBars
            title={t.scoreChangeChart}
            bars={bars}
          />
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <MoverList
          title={t.rising}
          lang={lang}
          rows={rising}
          version={version}
          patches={patches}
        />
        <MoverList
          title={t.falling}
          lang={lang}
          rows={falling}
          version={version}
          patches={patches}
        />
      </div>
    </div>
  );
}

function MoverList({
  title,
  rows,
  version,
  patches,
  lang,
}: {
  title: string;
  lang: Lang;
  rows: { stat: ChampionStat; spark: (number | null)[] }[];
  version: string;
  patches: string[];
}) {
  const t = dict(lang);
  return (
    <Panel title={title}>
      <p className="mb-3 text-xs text-muted">
        {t.sparkCaption(
          patches.length,
          patches[0],
          patches[patches.length - 1],
        )}
      </p>
      <ul className="space-y-2">
        {rows.map(({ stat, spark }) => {
          const up = stat.scoreChange! >= 0;
          return (
            <li key={stat.champion.id}>
              <Link
                href={`/champions/${stat.champion.id}?lane=${stat.lane}`}
                className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-panel-2"
              >
                <Icon
                  src={img.champion(version, stat.champion.image.full)}
                  alt={stat.champion.name}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">{stat.champion.name}</span>
                    <TierBadge tier={stat.tier} lang={lang} />
                  </div>
                  <div className="text-xs text-muted">
                    {t.winRate} <WinRate value={stat.winRate} />
                    {stat.winRateChange !== null && (
                      <span className="ml-1">
                        ({stat.winRateChange >= 0 ? "+" : ""}
                        {stat.winRateChange.toFixed(2)}%p)
                      </span>
                    )}
                    {stat.rankChange !== null && stat.rankChange !== 0 && (
                      <span className="ml-2">
                        {t.rank} {stat.rankChange > 0 ? "▲" : "▼"}
                        {Math.abs(stat.rankChange)}
                      </span>
                    )}
                  </div>
                </div>
                <Sparkline values={spark} />
                <span
                  className={`w-12 text-right text-sm font-semibold ${up ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}
                >
                  {up ? "▲" : "▼"}
                  {Math.abs(stat.scoreChange!).toFixed(1)}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="text-sm text-muted">{t.noMatches}</li>
        )}
      </ul>
    </Panel>
  );
}
