import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, Panel, Tabs, TierBadge, WinRate, pct } from "@/components/ui";
import TrendChart from "@/components/TrendChart";
import WinRateGrid from "@/components/WinRateGrid";
import HiddenTips from "@/components/HiddenTips";
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
import {
  loadRealData,
  realBuild,
  realChamp,
  realCorePath,
  realMatchups,
  realWinRates,
  type SlotOption,
} from "@/lib/real";
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
  if (!data) return { title: t.champion };
  const n = data.champion.name;
  return {
    title: t.champMetaTitle(n),
    description:
      lang === "ko"
        ? `${n} 승률, 추천 룬·아이템 빌드, 스킬 순서, 쉬운/어려운 상대를 이번 패치 기준으로 정리했어요.`
        : `${n} win rate, best runes and item builds, skill order and easy/hard matchups for the current patch.`,
  };
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
  // 카운터는 표본이 많이 필요해서 항상 에메랄드+ 전체 데이터로 계산합니다
  const allAgg = agg
    ? (realChamp(loadRealData({ server, rank: "all" }).get(patch) ?? real.get(patch)!, champion, lane) ?? agg)
    : null;
  const mu = allAgg ? realMatchups(allAgg, champion, champions) : null;
  const cp = agg ? realCorePath(agg, items) : null;
  const wr = agg ? realWinRates(agg, items, trees, spells) : null;
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
          <WinRateGrid wr={wr} version={version} lang={lang} />
        </Panel>
      )}

      {wr && <HiddenTips wr={wr} version={version} lang={lang} champName={champion.name} />}

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
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate} games={o.games}>
                    <RunePageView page={o.value} trees={trees} big={i === 0} />
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <Panel title={t.corePath}>
              {!cp || cp.path.length === 0 ? (
                <Empty lang={lang} />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {cp.path.map((opts, i) => (
                    <div key={i} className="rounded-md bg-panel-2 p-2">
                      <p className="mb-2 text-center text-xs font-semibold text-muted">{t.coreSlot(i + 1)}</p>
                      <ul className="space-y-2">
                        {opts.map((o) => (
                          <SlotRow key={o.item.id} o={o} version={version} lang={lang} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {cp && cp.builds.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-xs font-semibold text-muted">{t.fullBuilds}</p>
                  <div className="space-y-2">
                    {cp.builds.map((o, i) => (
                      <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate} games={o.games}>
                        <div className="flex flex-wrap items-center gap-1">
                          {o.value.map((item, j) => (
                            <span key={item.id} className="flex items-center gap-1">
                              {j > 0 && <span className="text-muted">›</span>}
                              <Icon src={img.item(version, item.id)} alt={item.name} size={36} />
                            </span>
                          ))}
                        </div>
                      </OptionRow>
                    ))}
                  </div>
                </>
              )}
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
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate} games={o.games}>
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
                  <OptionRow lang={lang} key={i} winRate={o.winRate} pickRate={o.pickRate} games={o.games}>
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
            {[...mu.easy, ...mu.hard].some((m) => m.games < 10) && (
              <p className="px-1 text-xs text-muted">{t.matchupNote}</p>
            )}
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
  games,
  lang,
}: {
  lang: Lang;
  children: React.ReactNode;
  winRate: number;
  pickRate: number;
  games?: number;
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
        {games !== undefined && (
          <div className={games < 30 ? "text-amber-400" : "text-muted"} title={games < 30 ? t.lowSampleTip : undefined}>
            {games < 30 && "⚠ "}
            {t.gamesN(games)}
          </div>
        )}
      </div>
    </div>
  );
}

// 게임 룬 페이지처럼: 주 룬 계열(핵심 룬 + 3줄)과 보조 룬 계열(3줄)을 나란히, 고른 룬만 밝게
function RunePageView({
  page,
  trees,
  big = false,
}: {
  page: RunePage;
  trees: RuneTree[];
  big?: boolean;
}) {
  const chosen = new Set([page.keystone, ...page.primaryRunes, ...page.secondaryRunes]);
  const primary = trees.find((t) => t.id === page.primary.id) ?? page.primary;
  const secondary = trees.find((t) => t.id === page.secondary.id) ?? page.secondary;
  const size = big ? 32 : 26;
  const row = (runes: RuneTree["slots"][number]["runes"], s: number) => (
    <div className="flex items-center justify-center gap-2">
      {runes.map((r) => (
        <Icon
          key={r.id}
          src={img.rune(r.icon)}
          alt={r.name}
          size={s}
          className={`rounded-full bg-bg ${chosen.has(r.id) ? "ring-2 ring-accent" : "opacity-25 grayscale"}`}
        />
      ))}
    </div>
  );
  const head = (tree: RuneTree) => (
    <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold">
      <Icon src={img.rune(tree.icon)} alt={tree.name} size={18} />
      {tree.name}
    </div>
  );
  return (
    <div className="flex flex-1 flex-wrap justify-center gap-x-6 gap-y-3 sm:flex-nowrap">
      <div className="min-w-0 space-y-2">
        {head(primary)}
        {row(primary.slots[0].runes, size + 10)}
        {primary.slots.slice(1).map((s, i) => (
          <div key={i}>{row(s.runes, size)}</div>
        ))}
      </div>
      <div className="w-px self-stretch bg-line max-sm:hidden" />
      <div className="min-w-0 space-y-2">
        {head(secondary)}
        {secondary.slots.slice(1).map((s, i) => (
          <div key={i}>{row(s.runes, size)}</div>
        ))}
      </div>
    </div>
  );
}

function SlotRow({ o, version, lang }: { o: SlotOption; version: string; lang: Lang }) {
  const t = dict(lang);
  return (
    <li className="flex items-center gap-2" title={`${o.item.name} · ${t.winRate} ${o.winRate.toFixed(1)}% · ${o.games}`}>
      <Icon src={img.item(version, o.item.id)} alt={o.item.name} size={32} />
      <div className="min-w-0 text-[11px] leading-tight">
        <WinRate value={o.winRate} />
        <span className="block text-muted">
          {t.pickShort} {o.pickRate.toFixed(0)}%
        </span>
      </div>
    </li>
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
  if (!rows.length) return <Empty lang={lang} />;
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
