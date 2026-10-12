import type { Metadata } from "next";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { StockLine } from "@/components/charts";
import { LiveBadge } from "@/components/LivePanel";
import { Icon, Panel, Tabs } from "@/components/ui";
import { dayLabel, loadDaily, pickMovers, WINDOW, type PickMover } from "@/lib/daily";
import { getChampions, img, type Champion } from "@/lib/ddragon";
import { LANES, parseLane, serverLabel, type Lane } from "@/lib/lanes";
import { getServer } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "메타 차트" };

type Props = { searchParams: Promise<{ lane?: string }> };

export default async function MetaPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane = parseLane(params.lane);
  const [{ version, champions }, server] = await Promise.all([getChampions(), getServer()]);
  const daily = loadDaily(server);
  const moves = daily ? pickMovers(daily, lane) : null;
  const byKey = new Map(champions.map((c) => [c.key, c]));

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          메타 차트 <LiveBadge />
        </h1>
        <span className="text-sm text-muted">
          {serverLabel(server)} 서버 · 에메랄드+ · 날짜별 픽률 ({WINDOW}일 이동 평균)
          {daily && ` · ${dayLabel(daily.days[0])}~${dayLabel(daily.days[daily.days.length - 1])}`}
        </span>
      </div>
      <p className="text-sm text-muted">
        주식 차트처럼 요즘 많이 골라지고 있는 챔피언과 덜 골라지는 챔피언을 보여줘요. 최근 {WINDOW}일 픽률을 그 전 {WINDOW}일과 비교했어요.
      </p>
      <Tabs active={lane} items={LANES.map((l) => ({ id: l.id, label: l.label, href: `/meta?lane=${l.id}` }))} />

      {!moves ? (
        <Panel>
          <p className="text-sm text-muted">
            이 서버의 날짜별 기록을 모으는 중이에요. 다음 수집(6시간마다)이 끝나면 차트가 표시돼요.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="▲ 픽률 상승">
            <Cards rows={moves.rising} up byKey={byKey} version={version} lane={lane} />
          </Panel>
          <Panel title="▼ 픽률 하락">
            <Cards rows={moves.falling} up={false} byKey={byKey} version={version} lane={lane} />
          </Panel>
        </div>
      )}
    </div>
  );
}

function Cards({
  rows,
  up,
  byKey,
  version,
  lane,
}: {
  rows: PickMover[];
  up: boolean;
  byKey: Map<string, Champion>;
  version: string;
  lane: Lane;
}) {
  const list = rows.flatMap((r) => {
    const c = byKey.get(r.championKey);
    return c ? [{ r, c }] : [];
  });
  if (!list.length) return <p className="text-sm text-muted">아직 눈에 띄는 변화가 없어요.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map(({ r, c }) => {
        const now = r.values[r.values.length - 1];
        return (
          <li key={r.championKey}>
            <Link
              href={`/champions/${c.id}?lane=${lane}`}
              title={`${c.name} 픽률 ${now.toFixed(2)}% (최근 ${WINDOW}일 ${r.recentGames}게임)`}
              className="block rounded-md bg-panel-2 p-3 hover:ring-1 hover:ring-line"
            >
              <div className="flex items-center gap-2">
                <Icon src={img.champion(version, c.image.full)} alt={c.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">픽률 {now.toFixed(2)}%</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {up ? "▲" : "▼"}
                  {Math.abs(r.change).toFixed(2)}%p
                </span>
              </div>
              <StockLine values={r.values} up={up} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
