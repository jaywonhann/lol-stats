import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, Panel, Tabs, TierBadge, WinRate, pct } from "@/components/ui";
import { getChampion, getChampions, getItems, getRuneTrees, getSummonerSpells, img, patchLabel, type RuneTree } from "@/lib/ddragon";
import { LANES, RANKS, laneLabel, parseRank, type Lane } from "@/lib/lanes";
import { build, championStat, lanesFor, matchups, type Matchup, type RunePage } from "@/lib/mock";

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

  const [{ champions }, items, trees, spells] = await Promise.all([
    getChampions(),
    getItems(version),
    getRuneTrees(version),
    getSummonerSpells(version),
  ]);

  const patch = patchLabel(version);
  const lanes = lanesFor(champion);
  const lane: Lane = lanes.includes(sp.lane as Lane) ? (sp.lane as Lane) : lanes[0];
  const rank = parseRank(sp.rank);
  const stat = championStat(champions, champion, lane, rank, patch);
  const b = build(champion, lane, rank, patch, items, trees, spells);
  const mu = matchups(champions, champion, lane, rank, patch);
  const href = (l: string, r: string) => `/champions/${champion.id}?lane=${l}&rank=${r}`;

  return (
    <div className="space-y-4">
      {/* 요약 헤더 */}
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Icon src={img.champion(version, champion.image.full)} alt={champion.name} size={80} className="rounded-lg" />
          <div className="flex-1">
            <p className="text-xs text-muted">{champion.title}</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {champion.name}
              {stat && <TierBadge tier={stat.tier} />}
            </h1>
            <div className="mt-2 flex gap-1">
              {[champion.passive, ...champion.spells].map((s, i) => (
                <div key={s.name} className="relative">
                  <Icon src={i === 0 ? img.passive(version, s.image.full) : img.spell(version, s.image.full)} alt={s.name} size={32} />
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
          <Tabs active={lane} items={LANES.filter((l) => lanes.includes(l.id)).map((l) => ({ id: l.id, label: l.label, href: href(l.id, rank) }))} />
          <Tabs active={rank} items={RANKS.map((r) => ({ id: r.id, label: r.label, href: href(lane, r.id) }))} />
        </div>
        <p className="mt-3 text-xs text-muted">
          패치 {patch} · {laneLabel(lane)} · {stat ? `${stat.games.toLocaleString("ko-KR")}게임` : ""}
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="추천 룬">
            <div className="space-y-4">
              {b.runes.map((o, i) => (
                <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                  <RunePageView page={o.value} trees={trees} />
                </OptionRow>
              ))}
            </div>
          </Panel>

          <Panel title="코어 아이템">
            <div className="space-y-2">
              {b.core.map((o, i) => (
                <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                  <div className="flex items-center gap-1">
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
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="시작 아이템">
              <div className="space-y-2">
                {b.starters.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <div className="flex gap-1">
                      {o.value.map((item) => (
                        <Icon key={item.id} src={img.item(version, item.id)} alt={item.name} />
                      ))}
                    </div>
                  </OptionRow>
                ))}
              </div>
            </Panel>
            <Panel title="신발">
              <div className="space-y-2">
                {b.boots.map((o, i) => (
                  <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                    <Icon src={img.item(version, o.value.id)} alt={o.value.name} />
                  </OptionRow>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="소환사 주문">
            <div className="space-y-2">
              {b.spells.map((o, i) => (
                <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                  <div className="flex gap-1">
                    {o.value.map((s) => (
                      <Icon key={s.id} src={img.spell(version, s.image.full)} alt={s.name} />
                    ))}
                  </div>
                </OptionRow>
              ))}
            </div>
          </Panel>

          <Panel title="스킬 마스터 순서">
            <div className="space-y-2">
              {b.skillOrder.map((o, i) => (
                <OptionRow key={i} winRate={o.winRate} pickRate={o.pickRate}>
                  <div className="flex items-center gap-1">
                    {o.value.map((k, j) => {
                      const spell = champion.spells["QWE".indexOf(k)];
                      return (
                        <span key={k} className="flex items-center gap-1">
                          {j > 0 && <span className="text-muted">›</span>}
                          <span className="relative">
                            <Icon src={img.spell(version, spell.image.full)} alt={spell.name} />
                            <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">{k}</span>
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

function OptionRow({ children, winRate, pickRate }: { children: React.ReactNode; winRate: number; pickRate: number }) {
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
  const all = new Map(trees.flatMap((t) => t.slots.flatMap((s) => s.runes)).map((r) => [r.id, r]));
  const rune = (id: number, size: number) => {
    const r = all.get(id)!;
    return <Icon key={id} src={img.rune(r.icon)} alt={r.name} size={size} className="rounded-full bg-bg" />;
  };
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1">
        <Icon src={img.rune(page.primary.icon)} alt={page.primary.name} size={20} />
        {rune(page.keystone, 40)}
        {page.primaryRunes.map((id) => rune(id, 28))}
      </div>
      <div className="flex items-center gap-1">
        <Icon src={img.rune(page.secondary.icon)} alt={page.secondary.name} size={20} />
        {page.secondaryRunes.map((id) => rune(id, 28))}
      </div>
    </div>
  );
}

function MatchupList({ rows, version, lane }: { rows: Matchup[]; version: string; lane: Lane }) {
  return (
    <ul className="space-y-2">
      {rows.map((m) => (
        <li key={m.champion.id}>
          <Link href={`/champions/${m.champion.id}?lane=${lane}`} className="flex items-center gap-2 hover:text-accent">
            <Icon src={img.champion(version, m.champion.image.full)} alt={m.champion.name} size={28} />
            <span className="flex-1 truncate text-sm">{m.champion.name}</span>
            <span className="text-right text-xs">
              <WinRate value={m.winRate} />
              <span className="block text-muted">{m.games.toLocaleString("ko-KR")}게임</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
