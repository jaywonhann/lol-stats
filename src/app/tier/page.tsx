import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Tabs, TierBadge, WinRate, pct } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import {
  LANES,
  RANKS,
  parseLane,
  parseRank,
  rankLabel,
  serverLabel,
} from "@/lib/lanes";
import { getServer } from "@/lib/server";
import LivePanel from "@/components/LivePanel";
import AutoRefresh from "@/components/AutoRefresh";
import { boards } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "챔피언 티어 리스트" };

type Props = {
  searchParams: Promise<{ lane?: string; rank?: string; patch?: string }>;
};

export default async function TierPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane = parseLane(params.lane);
  const rank = parseRank(params.rank);
  const [{ version, champions }, allPatches, server] = await Promise.all([
    getChampions(),
    getPatches(),
    getServer(),
  ]);
  const {
    source,
    patches,
    boards: bs,
    real,
  } = boards(champions, lane, { server, rank }, allPatches);
  const latest = patches[patches.length - 1];
  const patch =
    params.patch && patches.includes(params.patch) ? params.patch : latest;
  const rows = bs[patches.indexOf(patch)];
  const q = (o: { lane?: string; rank?: string; patch?: string }) =>
    `/tier?lane=${o.lane ?? lane}&rank=${o.rank ?? rank}${(o.patch ?? patch) !== latest ? `&patch=${o.patch ?? patch}` : ""}`;

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-2xl font-bold">챔피언 티어 리스트</h1>
            <span className="text-sm text-muted">
              패치 {patch} · {serverLabel(server)} 서버 · {rankLabel(rank)} ·{" "}
              {source === "real"
                ? `솔로랭크 ${real.get(patch)!.matches.toLocaleString("ko-KR")}게임`
                : "예시 데이터"}
            </span>
          </div>

          <div className="space-y-2">
            <Tabs
              active={lane}
              items={LANES.map((l) => ({
                id: l.id,
                label: l.label,
                href: q({ lane: l.id }),
              }))}
            />
            <Tabs
              active={rank}
              items={RANKS.map((r) => ({
                id: r.id,
                label: r.label,
                href: q({ rank: r.id }),
              }))}
            />
            {patches.length > 1 && (
              <Tabs
                active={patch}
                items={patches
                  .slice(-3)
                  .reverse()
                  .map((p) => ({
                    id: p,
                    label: `패치 ${p}`,
                    href: q({ patch: p }),
                  }))}
              />
            )}
          </div>
        </div>
        <LivePanel server={server} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">순위</th>
              <th className="px-3 py-2 text-left">챔피언</th>
              <th className="px-3 py-2">티어</th>
              <th className="px-3 py-2 text-right">메타 점수</th>
              <th className="px-3 py-2 text-right">승률</th>
              <th className="px-3 py-2 text-right">픽률</th>
              <th className="px-3 py-2 text-right">밴율</th>
              <th className="px-3 py-2 text-right">표본수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.champion.id}
                className="border-b border-line/50 last:border-0 hover:bg-panel-2"
              >
                <td className="px-3 py-2">
                  <span className="font-semibold">{s.rank}</span>
                  <RankChange value={s.rankChange} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/champions/${s.champion.id}?lane=${lane}&rank=${rank}`}
                    className="flex items-center gap-2 hover:text-accent"
                  >
                    <Icon
                      src={img.champion(version, s.champion.image.full)}
                      alt={s.champion.name}
                    />
                    {s.champion.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center">
                  <TierBadge tier={s.tier} />
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {s.score.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right">
                  <WinRate value={s.winRate} />
                </td>
                <td className="px-3 py-2 text-right">{pct(s.pickRate)}</td>
                <td className="px-3 py-2 text-right">{pct(s.banRate)}</td>
                <td className="px-3 py-2 text-right text-muted">
                  {s.games.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankChange({ value }: { value: number | null }) {
  if (value === null)
    return <span className="ml-1 text-xs text-accent">NEW</span>;
  if (value === 0) return <span className="ml-1 text-xs text-muted">-</span>;
  return (
    <span
      className={`ml-1 text-xs ${value > 0 ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}
    >
      {value > 0 ? "▲" : "▼"}
      {Math.abs(value)}
    </span>
  );
}
