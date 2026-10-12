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
import { getServer } from "@/lib/server";
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
  const data = await getChampion(id);
  return { title: data ? `${data.champion.name} 빌드, 룬, 카운터` : "챔피언" };
}

export default async function ChampionPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getChampion(id);
  if (!data) notFound();
  const { version, champion } = data;

  const [{ champions }, patches, items, trees, spells, server] =
    await Promise.all([
      getChampions(),
      getPatches(),
      getItems(version),
      getRuneTrees(version),
      getSummonerSpells(version),
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
              {stat && <TierBadge tier={stat.tier} />}
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
              <Stat label="메타 점수" value={stat.score.toFixed(1)} />
              <Stat label="승률" value={<WinRate value={stat.winRate} />} />
              <Stat label="픽률" value={pct(stat.pickRate)} />
              <Stat label="밴율" value={pct(stat.banRate)} />
            </dl>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <Tabs
            active={lane}
            items={LANES.filter((l) => lanes.includes(l.id)).map((l) => ({
              id: l.id,
              label: l.label,
              href: href(l.id, rank),
            }))}
          />
          <Tabs
            active={rank}
            items={RANKS.map((r) => ({
              id: r.id,
              label: r.label,
              href: href(lane, r.id),
            }))}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          패치 {patch} · {laneLabel(lane)}
          {stat && ` · ${stat.games.toLocaleString("ko-KR")}게임`}
          {` · ${serverLabel(server)} 서버 · ${rankLabel(rank)}`}
          {source === "real" ? " 솔로랭크 실제 게임" : " · 승률·픽률은 예시 데이터"}
        </p>
      </Panel>

      {trend.length > 1 && (
        <Panel title={`패치별 추이 (최근 ${trend.length}개 패치)`}>
          <div className="grid gap-6 md:grid-cols-2">
            <TrendChart
              title="승률"
              suffix="%"
              baseline={50}
              points={trend.map((t) => ({ label: t.patch, value: t.winRate }))}
            />
            <TrendChart
              title={`${laneLabel(lane)} 순위`}
              suffix="위"
              decimals={0}
              invert
              points={trend.map((t) => ({
                label: t.patch,
                value: t.rank,
                note: `${t.tier === "OP" ? "OP" : `${t.tier}티어`}`,
              }))}
            />
          </div>
        </Panel>
      )}

      {wr && (
        <Panel title="지금 승률 높은 빌드">
          <p className="mb-4 text-xs text-muted">
            최근 수집한 {agg!.games.toLocaleString("ko-KR")}게임 기준
            {updatedAt && ` · ${ago(updatedAt)} 업데이트`} · 많이 쓰인 선택지 중
            승률 순 · 게임 수가 적은 선택지는 제외
          </p>
          <div className="grid gap-6 lg:grid-cols-3">
            <WinRateBars
              title="핵심 룬 + 보조 룬"
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
              title="코어 아이템 (먼저 완성한 2개)"
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
              title="신발"
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
        <Panel title="템트리 승률 추이">
          <p className="mb-3 text-xs text-muted">
            많이 쓰인 코어템 조합(먼저 완성한 2개)의 날짜별 승률 · {WINDOW}일 이동 평균 ·{" "}
            {serverLabel(server)} 서버 에메랄드+ · 표본이 적은 날은 비워 둠
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
                <span className="text-muted">{s.total}게임</span>
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
            <Panel title="추천 룬">
              <div className="space-y-4">
                {b.runes.length === 0 && <Empty />}
                {b.runes.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <RunePageView page={o.value} trees={trees} />
                  </OptionRow>
                ))}
              </div>
            </Panel>

            <Panel title="코어 아이템">
              <div className="space-y-2">
                {b.core.length === 0 && <Empty />}
                {b.core.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
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
              <Panel title="시작 아이템">
                <div className="space-y-2">
                  {b.starters.length === 0 && <Empty />}
                  {b.starters.map((o, i) => (
                    <OptionRow
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
              <Panel title="신발">
                <div className="space-y-2">
                  {b.boots.length === 0 && <Empty />}
                  {b.boots.map((o, i) => (
                    <OptionRow
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
            <Panel title="소환사 주문">
              <div className="space-y-2">
                {b.spells.length === 0 && <Empty />}
                {b.spells.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
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

            <Panel title="스킬 마스터 순서">
              <div className="space-y-2">
                {b.skillOrder.length === 0 && <Empty />}
                {b.skillOrder.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
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

            <Panel title="상대하기 쉬운 챔피언">
              <MatchupList rows={mu.easy} version={version} lane={lane} />
            </Panel>
            <Panel title="상대하기 어려운 챔피언">
              <MatchupList rows={mu.hard} version={version} lane={lane} />
            </Panel>
          </div>
        </div>
      ) : (
        <Panel title="빌드 · 룬 · 카운터">
          <p className="text-sm text-muted">
            {source === "real"
              ? `이번 패치에서 ${champion.name} ${laneLabel(lane)} 게임이 아직 충분히 모이지 않았어요. 게임이 더 모이면 실제 빌드가 표시돼요.`
              : "실제 랭크 게임 데이터를 수집하기 시작하면 이곳에 상위 랭커들이 실제로 쓰는 룬, 아이템, 스펠, 스킬 순서, 카운터가 표시돼요."}
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

function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "1시간 이내" : h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}

function Empty() {
  return <p className="text-sm text-muted">아직 표본이 부족해요.</p>;
}

function OptionRow({
  children,
  winRate,
  pickRate,
}: {
  children: React.ReactNode;
  winRate: number;
  pickRate: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-panel-2 px-3 py-2">
      {children}
      <div className="shrink-0 text-right text-xs">
        <div>
          승률 <WinRate value={winRate} />
        </div>
        <div className="text-muted">픽률 {pct(pickRate)}</div>
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
}: {
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
                {m.games.toLocaleString("ko-KR")}게임
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
