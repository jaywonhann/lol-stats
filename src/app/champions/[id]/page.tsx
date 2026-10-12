import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, Panel, Tabs, TierBadge, WinRate, pct } from "@/components/ui";
import TrendChart from "@/components/TrendChart";
import { WinRateBars } from "@/components/charts";
import MultiLineChart from "@/components/MultiLineChart";
import { buildSeries, dayLabel, loadDaily, WINDOW } from "@/lib/daily";
import {
  getChampion,
  getChampions,
  getItems,
  getPatches,
  getRuneTrees,
  getSummonerSpells,
  img,
  type RuneTree,
} from "@/lib/ddragon";
import {
  LANES,
  RANKS,
  laneLabel,
  parseRank,
  rankLabel,
  serverLabel,
  type Lane,
} from "@/lib/lanes";
import { getLang, getServer } from "@/lib/server";
import { ddLocale, dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import type { Matchup, RunePage } from "@/lib/mock";
import { realBuild, realChamp, realMatchups, realWinRates } from "@/lib/real";
import { boards, lanesOf } from "@/lib/stats";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lane?: string; rank?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lang = await getLang();
  const t = dict(lang);
  const data = await getChampion(id, ddLocale(lang));
  return { title: data ? t.champMetaTitle(data.champion.name) : t.champion };
}

export default async function ChampionPage({ params, searchParams }: Props) {
  const [{ id }, sp, lang] = await Promise.all([params, searchParams, getLang()]);
  const t = dict(lang);
  const nl = numLocale(lang);
  const loc = ddLocale(lang);
  const data = await getChampion(id, loc);
  if (!data) notFound();
  const { version, champion } = data;

  const [{ champions }, patches, items, trees, spells, server] =
    await Promise.all([
      getChampions(loc),
      getPatches(),
      getItems(version, loc),
      getRuneTrees(version, loc),
      getSummonerSpells(version, loc),
      getServer(),
    ]);
  const rank = parseRank(sp.rank);
  const filter = { server, rank };

  const lanes = lanesOf(champion, patches, filter);
  const lane: Lane = lanes.includes(sp.lane as Lane)
    ? (sp.lane as Lane)
    : lanes[0];
  const {
    source,
    patches: statPatches,
    boards: bs,
    real,
  } = boards(champions, lane, filter, patches);
  const patch = statPatches[statPatches.length - 1];
  const trend = bs
    .map((b) => b.find((s) => s.champion.id === champion.id))
    .filter((s) => s !== undefined);
  const stat = trend.find((t) => t.patch === patch) ?? null;
  // 빌드·카운터는 실제 수집 데이터가 있을 때만 보여줍니다
  const agg =
    source === "real" ? realChamp(real.get(patch)!, champion, lane) : null;
  const b = agg ? realBuild(agg, items, trees, spells) : null;
  const mu = agg ? realMatchups(agg, champion, champions) : null;
  const wr = agg ? realWinRates(agg, items, trees) : null;
  const updatedAt = source === "real" ? real.get(patch)!.updatedAt : null;
  const daily = loadDaily(server);
  const builds = daily ? buildSeries(daily, `${champion.key}:${lane}`) : [];
  const itemById = new Map(items.map((i) => [i.id, i]));
  const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70"]; // 색약 검사 통과 (어두운 배경)
  const href = (l: string, r: string) =>
    `/champions/${champion.id}?lane=${l}&rank=${r}`;

  return (
    <div className="space-y-4">
      {/* 요약 헤더 */}
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Icon
            src={img.champion(version, champion.image.full)}
            alt={champion.name}
            size={80}
            className="rounded-lg"
          />
          <div className="flex-1">
            <p className="text-xs text-muted">{champion.title}</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {champion.name}
              {stat && <TierBadge tier={stat.tier} lang={lang} />}
            </h1>
            <div className="mt-2 flex gap-1">
              {[champion.passive, ...champion.spells].map((s, i) => (
                <div key={s.name} className="relative">
                  <Icon
                    src={
                      i === 0
                        ? img.passive(version, s.image.full)
                        : img.spell(version, s.image.full)
                    }
                    alt={s.name}
                    size={32}
                  />
                  <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">
                    {i === 0 ? "P" : "QWER"[i - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {stat && (
            <dl className="grid grid-cols-4 gap-4 text-center">
              <Stat label={t.metaScore} value={stat.score.toFixed(1)} />
              <Stat label={t.winRate} value={<WinRate value={stat.winRate} />} />
              <Stat label={t.pickRate} value={pct(stat.pickRate)} />
              <Stat label={t.banRate} value={pct(stat.banRate)} />
            </dl>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <Tabs
            active={lane}
            items={LANES.filter((l) => lanes.includes(l.id)).map((l) => ({
              id: l.id,
              label: laneLabel(l.id, lang),
              href: href(l.id, rank),
            }))}
          />
          <Tabs
            active={rank}
            items={RANKS.map((r) => ({
              id: r.id,
              label: rankLabel(r.id, lang),
              href: href(lane, r.id),
            }))}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          {t.patch(patch)} · {laneLabel(lane, lang)}
          {stat && ` · ${t.games(stat.games.toLocaleString(nl))}`}
          {` · ${t.serverName(serverLabel(server, lang))} · ${rankLabel(rank, lang)}`}
          {source === "real" ? t.sourceReal : t.sourceMock}
        </p>
      </Panel>

      {trend.length > 1 && (
        <Panel title={t.patchTrend(trend.length)}>
          <div className="grid gap-6 md:grid-cols-2">
            <TrendChart
              title={t.winRate}
              suffix="%"
              baseline={50}
              points={trend.map((p) => ({ label: p.patch, value: p.winRate }))}
            />
            <TrendChart
              title={t.laneRank(laneLabel(lane, lang))}
              suffix={t.rankSuffix}
              decimals={0}
              invert
              points={trend.map((p) => ({
                label: p.patch,
                value: p.rank,
                note: t.tier(p.tier),
              }))}
            />
          </div>
        </Panel>
      )}

      {wr && (
        <Panel title={t.topBuilds}>
          <p className="mb-4 text-xs text-muted">
            {t.topBuildsNote(
              agg!.games.toLocaleString(nl),
              updatedAt ? t.updated(timeAgo(updatedAt, lang)) : null,
            )}
          </p>
          <div className="grid gap-6 lg:grid-cols-3">
            <WinRateBars
              title={t.keystoneSecondary}
              lang={lang}
              rows={wr.runes.map((r) => ({
                key: `${r.value.keystone.id}-${r.value.secondary.id}`,
                name: `${r.value.keystone.name} + ${r.value.secondary.name}`,
                winRate: r.winRate,
                games: r.games,
                label: (
                  <>
                    <Icon src={img.rune(r.value.keystone.icon)} alt={r.value.keystone.name} size={28} className="rounded-full bg-bg" />
                    <Icon src={img.rune(r.value.secondary.icon)} alt={r.value.secondary.name} size={18} />
                    <span className="truncate text-xs">{r.value.keystone.name}</span>
                  </>
                ),
              }))}
            />
            <WinRateBars
              title={t.coreFirstTwo}
              lang={lang}
              rows={wr.core.map((r) => ({
                key: r.value.map((i) => i.id).join("-"),
                name: r.value.map((i) => i.name).join(" › "),
                winRate: r.winRate,
                games: r.games,
                label: r.value.map((item, j) => (
                  <span key={item.id} className="flex items-center gap-1">
                    {j > 0 && <span className="text-muted">›</span>}
                    <Icon src={img.item(version, item.id)} alt={item.name} size={28} />
                  </span>
                )),
              }))}
            />
            <WinRateBars
              title={t.boots}
              lang={lang}
              rows={wr.boots.map((r) => ({
                key: r.value.id,
                name: r.value.name,
                winRate: r.winRate,
                games: r.games,
                label: (
                  <>
                    <Icon src={img.item(version, r.value.id)} alt={r.value.name} size={28} />
                    <span className="truncate text-xs">{r.value.name}</span>
                  </>
                ),
              }))}
            />
          </div>
        </Panel>
      )}

      {daily && builds.length > 0 && (
        <Panel title={t.buildTrend}>
          <p className="mb-3 text-xs text-muted">
            {t.buildTrendNote(WINDOW, serverLabel(server, lang))}
          </p>
          <div className="mb-2 flex flex-wrap gap-4">
            {builds.map((s, i) => (
              <span key={s.pair} className="flex items-center gap-1.5 text-xs">
                <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
                {s.pair.split(",").map((id, j) => {
                  const it = itemById.get(id);
                  return it ? (
                    <span key={id} className="flex items-center gap-1">
                      {j > 0 && <span className="text-muted">›</span>}
                      <Icon src={img.item(version, id)} alt={it.name} size={24} />
                    </span>
                  ) : null;
                })}
                <span className="text-muted">{t.games(s.total.toLocaleString(nl))}</span>
              </span>
            ))}
          </div>
          <MultiLineChart
            labels={daily.days.map(dayLabel)}
            baseline={50}
            series={builds.map((s, i) => ({
              name: s.pair
                .split(",")
                .map((id) => itemById.get(id)?.name ?? id)
                .join(" › "),
              color: SERIES_COLORS[i],
              values: s.values,
            }))}
          />
        </Panel>
      )}

      {b && mu ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title={t.recRunes}>
              <div className="space-y-4">
                {b.runes.length === 0 && <Empty lang={lang} />}
                {b.runes.map((o, i) => (
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <RunePageView page={o.value} trees={trees} />
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <Panel title={t.coreItems}>
              <div className="space-y-2">
                {b.core.length === 0 && <Empty lang={lang} />}
                {b.core.map((o, i) => (
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <div className="flex items-center gap-1">
                      {o.value.map((item, j) => (
                        <span key={item.id} className="flex items-center gap-1">
                          {j > 0 && <span className="text-muted">›</span>}
                          <Icon
                            src={img.item(version, item.id)}
                            alt={item.name}
                            size={36}
                          />
                        </span>
                      ))}
                    </div>
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title={t.startingItems}>
                <div className="space-y-2">
                  {b.starters.length === 0 && <Empty lang={lang} />}
                  {b.starters.map((o, i) => (
                    <OptionRow
                      lang={lang}
                      key={i}
                      winRate={o.winRate}
                      pickRate={o.pickRate}
                    >
                      <div className="flex gap-1">
                        {o.value.map((item) => (
                          <Icon
                            key={item.id}
                            src={img.item(version, item.id)}
                            alt={item.name}
                          />
                        ))}
                      </div>
                    </OptionRow>
                  ))}
                </div>
              </Panel>
              <Panel title={t.boots}>
                <div className="space-y-2">
                  {b.boots.length === 0 && <Empty lang={lang} />}
                  {b.boots.map((o, i) => (
                    <OptionRow
                      lang={lang}
                      key={i}
                      winRate={o.winRate}
                      pickRate={o.pickRate}
                    >
                      <Icon
                        src={img.item(version, o.value.id)}
                        alt={o.value.name}
                      />
                    </OptionRow>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <div className="space-y-4">
            <Panel title={t.summonerSpells}>
              <div className="space-y-2">
                {b.spells.length === 0 && <Empty lang={lang} />}
                {b.spells.map((o, i) => (
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <div className="flex gap-1">
                      {o.value.map((s) => (
                        <Icon
                          key={s.id}
                          src={img.spell(version, s.image.full)}
                          alt={s.name}
                        />
                      ))}
                    </div>
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <Panel title={t.skillOrder}>
              <div className="space-y-2">
                {b.skillOrder.length === 0 && <Empty lang={lang} />}
                {b.skillOrder.map((o, i) => (
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <div className="flex items-center gap-1">
                      {o.value.map((k, j) => {
                        const spell = champion.spells["QWE".indexOf(k)];
                        return (
                          <span key={k} className="flex items-center gap-1">
                            {j > 0 && <span className="text-muted">›</span>}
                            <span className="relative">
                              <Icon
                                src={img.spell(version, spell.image.full)}
                                alt={spell.name}
                              />
                              <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">
                                {k}
                              </span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <Panel title={t.easyMatchups}>
              <MatchupList lang={lang} rows={mu.easy} version={version} lane={lane} />
            </Panel>
            <Panel title={t.hardMatchups}>
              <MatchupList lang={lang} rows={mu.hard} version={version} lane={lane} />
            </Panel>
          </div>
        </div>
      ) : (
        <Panel title={t.buildRunesCounters}>
          <p className="text-sm text-muted">
            {source === "real"
              ? t.noBuildLane(champion.name, laneLabel(lane, lang))
              : t.noBuildYet}
          </p>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Empty({ lang }: { lang: Lang }) {
  return <p className="text-sm text-muted">{dict(lang).notEnoughSample}</p>;
}

function OptionRow({
  children,
  winRate,
  pickRate,
  lang,
}: {
  lang: Lang;
  children: React.ReactNode;
  winRate: number;
  pickRate: number;
}) {
  const t = dict(lang);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-panel-2 px-3 py-2">
      {children}
      <div className="shrink-0 text-right text-xs">
        <div>
          {t.winRate} <WinRate value={winRate} />
        </div>
        <div className="text-muted">{t.pickRate} {pct(pickRate)}</div>
      </div>
    </div>
  );
}

function RunePageView({ page, trees }: { page: RunePage; trees: RuneTree[] }) {
  const all = new Map(
    trees.flatMap((t) => t.slots.flatMap((s) => s.runes)).map((r) => [r.id, r]),
  );
  const rune = (id: number, size: number) => {
    const r = all.get(id)!;
    return (
      <Icon
        key={id}
        src={img.rune(r.icon)}
        alt={r.name}
        size={size}
        className="rounded-full bg-bg"
      />
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1">
        <Icon
          src={img.rune(page.primary.icon)}
          alt={page.primary.name}
          size={20}
        />
        {rune(page.keystone, 40)}
        {page.primaryRunes.map((id) => rune(id, 28))}
      </div>
      <div className="flex items-center gap-1">
        <Icon
          src={img.rune(page.secondary.icon)}
          alt={page.secondary.name}
          size={20}
        />
        {page.secondaryRunes.map((id) => rune(id, 28))}
      </div>
    </div>
  );
}

function MatchupList({
  rows,
  version,
  lane,
  lang,
}: {
  lang: Lang;
  rows: Matchup[];
  version: string;
  lane: Lane;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((m) => (
        <li key={m.champion.id}>
          <Link
            href={`/champions/${m.champion.id}?lane=${lane}`}
            className="flex items-center gap-2 hover:text-accent"
          >
            <Icon
              src={img.champion(version, m.champion.image.full)}
              alt={m.champion.name}
              size={28}
            />
            <span className="flex-1 truncate text-sm">{m.champion.name}</span>
            <span className="text-right text-xs">
              <WinRate value={m.winRate} />
              <span className="block text-muted">
                {dict(lang).games(m.games.toLocaleString(numLocale(lang)))}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
