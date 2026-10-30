import TrendTabs from "@/components/TrendTabs";
import type { Metadata } from "next";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { StockLine } from "@/components/charts";
import { LiveBadge } from "@/components/LivePanel";
import { Icon, Panel, Tabs } from "@/components/ui";
import { dayLabel, loadDaily, pickMovers, WINDOW, type PickMover } from "@/lib/daily";
import { getChampions, img, type Champion } from "@/lib/ddragon";
import { ddLocale, dict, type Lang } from "@/lib/i18n";
import { LANES, laneLabel, parseLane, serverLabel, type Lane } from "@/lib/lanes";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: dict(await getLang()).metaTitle,
    description: ko ? "라인별로 최근 3일 픽률이 오르고 내린 챔피언을 주식 시세처럼 보여줘요." : "Champions whose pick rate is rising or falling by lane over the last 3 days.",
  };
}

type Props = { searchParams: Promise<{ lane?: string }> };

export default async function MetaPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane = parseLane(params.lane);
  const lang = await getLang();
  const t = dict(lang);
  const [{ version, champions }, server] = await Promise.all([getChampions(ddLocale(lang)), getServer()]);
  const daily = loadDaily(server);
  const moves = daily ? pickMovers(daily, lane) : null;
  const byKey = new Map(champions.map((c) => [c.key, c]));

  return (
    <div className="space-y-4">
      <TrendTabs active="meta" lang={lang} />
      <AutoRefresh />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          {t.metaTitle} <LiveBadge />
        </h1>
        <span className="text-sm text-muted">
          {t.metaSubtitle(serverLabel(server, lang), WINDOW)}
          {daily && ` · ${dayLabel(daily.days[0])}~${dayLabel(daily.days[daily.days.length - 1])}`}
        </span>
      </div>
      <p className="text-sm text-muted">
        {t.metaIntro(WINDOW)}
      </p>
      <Tabs active={lane} items={LANES.map((l) => ({ id: l.id, label: laneLabel(l.id, lang), href: `/meta?lane=${l.id}` }))} />

      {!moves ? (
        <Panel>
          <p className="text-sm text-muted">
            {t.metaCollecting}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t.pickRising}>
            <Cards lang={lang} rows={moves.rising} up byKey={byKey} version={version} lane={lane} />
          </Panel>
          <Panel title={t.pickFalling}>
            <Cards lang={lang} rows={moves.falling} up={false} byKey={byKey} version={version} lane={lane} />
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
  lang,
}: {
  lang: Lang;
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
  const t = dict(lang);
  if (!list.length) return <p className="text-sm text-muted">{t.noNotableChange}</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map(({ r, c }) => {
        const now = r.values[r.values.length - 1];
        return (
          <li key={r.championKey}>
            <Link
              href={`/champions/${c.id}?lane=${lane}`}
              title={t.metaCardTitle(c.name, now.toFixed(2), WINDOW, r.recentGames)}
              className="block rounded-md bg-panel-2 p-3 hover:ring-1 hover:ring-line"
            >
              <div className="flex items-center gap-2">
                <Icon src={img.champion(version, c.image.full)} alt={c.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{t.pickRate} {now.toFixed(2)}%</p>
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
