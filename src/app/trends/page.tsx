import { patchName } from "@/lib/lanes";
import TrendTabs from "@/components/TrendTabs";
import type { Metadata } from "next";
import Link from "@/components/Link";
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
import { ddLocale, dict, numLocale, type Lang } from "@/lib/i18n";
import type { ChampionStat } from "@/lib/mock";
import { movers, patchSwings, SWING_MIN_GAMES } from "@/lib/stats";
import { getLang, getServer, langAlternates } from "@/lib/server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ lane?: string; rank?: string }> };

// "26.22 패치 승률" 같은 검색과 링크 미리보기에 이번 패치 숫자가 바로 보이게, 제목과 설명에 패치와 대표 챔피언을 넣어요.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, lang, server] = await Promise.all([searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const ln = LANES.find((l) => l.id === sp.lane)?.id;
  const [{ champions }, allPatches] = await Promise.all([getChampions(ddLocale(lang)), getPatches()]);
  const sw = patchSwings(champions, { server, rank: "all" }, allPatches, 1);
  const alternates = await langAlternates(`/trends${ln ? `?lane=${ln}` : ""}`);
  const up = sw?.up[0];
  const down = sw?.down[0];
  if (!sw || !up || !down)
    return {
      alternates,
      title: dict(lang).trendsTitle,
      description: ko ? "패치별 승률과 메타 점수가 가장 많이 바뀐 챔피언을 모아봤어요." : "Champions whose win rate and meta score changed most between patches.",
    };
  const pp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%p`;
  return {
    alternates,
    title: ko ? `${patchName(sw.patch)} 패치 승률 변화 - 오른 챔피언·내린 챔피언` : `Patch ${patchName(sw.patch)} Win Rate Changes - Biggest Winners and Losers`,
    description: ko
      ? `${patchName(sw.patch)} 패치에서 승률이 가장 오른 챔피언은 ${up.champion.name}(${pp(up.change)}), 가장 내린 챔피언은 ${down.champion.name}(${pp(down.change)})예요. 실제 랭크 게임 ${sw.matches.toLocaleString("ko-KR")}판 기준.`
      : `Biggest winner of patch ${patchName(sw.patch)}: ${up.champion.name} (${pp(up.change)}). Biggest loser: ${down.champion.name} (${pp(down.change)}). From ${sw.matches.toLocaleString("en-US")} real ranked games.`,
  };
}

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
  const swings = patchSwings(champions, { server, rank }, allPatches);
  const ko = lang === "ko";
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
      <TrendTabs active="trends" lang={lang} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.trendsTitle}</h1>
        <span className="text-sm text-muted">
          {prev ? t.scoreChangeRange(prev, patch) : t.patch(patch)} ·{" "}
          {t.serverName(serverLabel(server, lang))} · {rankLabel(rank, lang)} ·{" "}
          {source === "real" ? t.realGames : t.sampleData}
        </span>
      </div>
      {swings && swings.up.length > 0 && swings.down.length > 0 && (
        <Panel title={ko ? `${patchName(swings.patch)} 패치 한눈에: 승률이 가장 많이 바뀐 챔피언` : `Patch ${patchName(swings.patch)} at a glance: biggest win rate changes`}>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <SwingList title={ko ? "오른 챔피언" : "Winners"} rows={swings.up} version={version} lang={lang} />
            <SwingList title={ko ? "내린 챔피언" : "Losers"} rows={swings.down} version={version} lang={lang} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {ko
              ? `모든 라인에서 ${patchName(swings.prev)} → ${patchName(swings.patch)} 승률 변화 기준이에요. 두 패치 모두 ${SWING_MIN_GAMES}판 이상 나온 챔피언만 봤어요 (이번 패치 ${swings.matches.toLocaleString(numLocale(lang))}판).`
              : `Win rate change from ${patchName(swings.prev)} to ${patchName(swings.patch)} across all lanes, for champions with ${SWING_MIN_GAMES}+ games in both patches (${swings.matches.toLocaleString(numLocale(lang))} games this patch).`}
          </p>
        </Panel>
      )}

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

function SwingList({
  title,
  rows,
  version,
  lang,
}: {
  title: string;
  rows: NonNullable<ReturnType<typeof patchSwings>>["up"];
  version: string;
  lang: Lang;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted">{title}</h3>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={`${r.champion.id}:${r.lane}`}>
            <Link href={`/champions/${r.champion.id}?lane=${r.lane}`} className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-panel-2">
              <Icon src={img.champion(version, r.champion.image.full)} alt={r.champion.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.champion.name}</div>
                <div className="text-xs text-muted">
                  {laneLabel(r.lane, lang)} · {r.games.toLocaleString(numLocale(lang))}
                  {lang === "ko" ? "판" : " games"}
                </div>
              </div>
              <div className="text-right text-xs text-muted tabular-nums">
                {r.before.toFixed(1)}% → <WinRate value={r.winRate} />
              </div>
              <span className={`w-16 text-right text-sm font-semibold tabular-nums ${r.change >= 0 ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}>
                {r.change >= 0 ? "▲" : "▼"}
                {Math.abs(r.change).toFixed(1)}%p
              </span>
            </Link>
          </li>
        ))}
      </ul>
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
