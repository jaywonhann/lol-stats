import type { Metadata } from "next";
import Link from "next/link";
import { DivergingBars, Sparkline } from "@/components/charts";
import { Icon, Panel, Tabs, TierBadge, WinRate } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES, RANKS, parseLane, parseRank } from "@/lib/lanes";
import { movers, type ChampionStat } from "@/lib/mock";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "패치 트렌드" };

type Props = { searchParams: Promise<{ lane?: string; rank?: string }> };

export default async function TrendsPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane = parseLane(params.lane);
  const rank = parseRank(params.rank);
  const [{ version, champions }, patches] = await Promise.all([getChampions(), getPatches()]);
  const patch = patches[patches.length - 1];
  const prev = patches[patches.length - 2];
  const { rising, falling } = movers(champions, lane, rank, patches, 8);
  const bars = [...rising, ...[...falling].reverse()].map(({ stat }) => ({
    label: stat.champion.name,
    value: stat.scoreChange!,
    detail: `메타 점수 ${stat.scoreChange! >= 0 ? "+" : ""}${stat.scoreChange!.toFixed(1)}, 승률 ${stat.winRate.toFixed(2)}%`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">패치 트렌드</h1>
        <span className="text-sm text-muted">
          패치 {prev} → {patch} 메타 점수 변화
        </span>
      </div>
      <div className="space-y-2">
        <Tabs active={lane} items={LANES.map((l) => ({ id: l.id, label: l.label, href: `/trends?lane=${l.id}&rank=${rank}` }))} />
        <Tabs active={rank} items={RANKS.map((r) => ({ id: r.id, label: r.label, href: `/trends?lane=${lane}&rank=${r.id}` }))} />
      </div>

      <Panel>
        <DivergingBars title={`메타 점수 변화가 큰 챔피언 (▲ 상승 · ▼ 하락)`} bars={bars} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <MoverList title="떠오르는 챔피언" rows={rising} version={version} patches={patches} />
        <MoverList title="떨어지는 챔피언" rows={falling} version={version} patches={patches} />
      </div>
    </div>
  );
}

function MoverList({
  title,
  rows,
  version,
  patches,
}: {
  title: string;
  rows: { stat: ChampionStat; spark: (number | null)[] }[];
  version: string;
  patches: string[];
}) {
  return (
    <Panel title={title}>
      <p className="mb-3 text-xs text-muted">
        그래프: 최근 {patches.length}개 패치({patches[0]}~{patches[patches.length - 1]}) 승률 흐름
      </p>
      <ul className="space-y-2">
        {rows.map(({ stat, spark }) => {
          const up = stat.scoreChange! >= 0;
          return (
            <li key={stat.champion.id}>
              <Link href={`/champions/${stat.champion.id}?lane=${stat.lane}`} className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-panel-2">
                <Icon src={img.champion(version, stat.champion.image.full)} alt={stat.champion.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">{stat.champion.name}</span>
                    <TierBadge tier={stat.tier} />
                  </div>
                  <div className="text-xs text-muted">
                    승률 <WinRate value={stat.winRate} />
                    {stat.winRateChange !== null && (
                      <span className="ml-1">
                        ({stat.winRateChange >= 0 ? "+" : ""}
                        {stat.winRateChange.toFixed(2)}%p)
                      </span>
                    )}
                    {stat.rankChange !== null && stat.rankChange !== 0 && (
                      <span className="ml-2">
                        순위 {stat.rankChange > 0 ? "▲" : "▼"}
                        {Math.abs(stat.rankChange)}
                      </span>
                    )}
                  </div>
                </div>
                <Sparkline values={spark} />
                <span className={`w-12 text-right text-sm font-semibold ${up ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}>
                  {up ? "▲" : "▼"}
                  {Math.abs(stat.scoreChange!).toFixed(1)}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-sm text-muted">해당하는 챔피언이 없어요.</li>}
      </ul>
    </Panel>
  );
}
