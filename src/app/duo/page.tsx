import type { Metadata } from "next";
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import RowFilter from "@/components/RowFilter";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { RANKS, SERVERS, parseRank, rankLabel } from "@/lib/lanes";
import { realDuoPairs } from "@/lib/real";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

const MIN_GAMES = 20;

type Props = { searchParams: Promise<{ rank?: string; sort?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "바텀 듀오 조합 티어 · 원딜 서포터 궁합 승률" : "Bot lane duo tier list: best ADC + support combos",
    description: ko
      ? "실제 랭크 게임으로 집계한 원딜·서포터 조합별 승률 순위. 내 원딜과 잘 맞는 서포터를 찾아보세요."
      : "ADC and support pairs ranked by win rate from real ranked games. Find the best support for your ADC.",
    alternates: { canonical: "/duo" },
  };
}

export default async function DuoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rank = parseRank(sp.rank);
  const sort = sp.sort === "pick" ? "pick" : "wr";
  const lang = await getLang();
  const ko = lang === "ko";
  const [{ version, champions }, alt] = await Promise.all([
    getChampions(ddLocale(lang)),
    getChampions(ddLocale(ko ? "en" : "ko")).then((r) => r.champions).catch(() => []),
  ]);
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const altName = new Map(alt.map((c) => [c.id, c.name]));
  const { pairs, patch, games } = realDuoPairs(rank, SERVERS.map((s) => s.id));
  const total = pairs.reduce((s, p) => s + p.wins, 0) / Math.max(1, games);
  // 판수가 적은 조합은 평균 쪽으로 당겨서(20판 가중) 순위를 정해요
  const rows = pairs
    .filter((p) => p.games >= MIN_GAMES && byKey.has(p.adc) && byKey.has(p.sup))
    .map((p) => ({ ...p, a: byKey.get(p.adc)!, s: byKey.get(p.sup)!, wr: (p.wins / p.games) * 100, score: (p.wins + total * 20) / (p.games + 20) }))
    .sort((x, y) => (sort === "pick" ? y.games - x.games : y.score - x.score))
    .slice(0, 100);
  const tab = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-accent font-semibold text-bg" : "bg-panel-2 text-muted hover:text-text"}`;
  const q = (r: string, s: string) => `/duo?${new URLSearchParams({ ...(r !== "all" ? { rank: r } : {}), ...(s === "pick" ? { sort: s } : {}) })}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "바텀 듀오 조합 순위" : "Bot lane duo tier list"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? `한국·북미·유럽 랭크 게임에서 같은 팀 원딜과 서포터가 만난 ${Math.round(games).toLocaleString()}번을 모았어요 (패치 ${patch ?? "-"}까지). ${MIN_GAMES}판 넘게 나온 조합만 보여줘요. 챔피언을 누르면 그 챔피언 빌드로 가요.`
            : `${Math.round(games).toLocaleString()} ADC + support pairings from ranked games on KR, NA and EUW (up to patch ${patch ?? "-"}). Only pairs with ${MIN_GAMES}+ games are shown. Click a champion for its build.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {RANKS.map((r) => (
          <Link key={r.id} href={q(r.id, sort)} className={tab(rank === r.id)}>{rankLabel(r.id, lang)}</Link>
        ))}
        <span className="mx-1 w-px bg-line" aria-hidden />
        <Link href={q(rank, "wr")} className={tab(sort === "wr")}>{ko ? "승률 순" : "Win rate"}</Link>
        <Link href={q(rank, "pick")} className={tab(sort === "pick")}>{ko ? "많이 하는 순" : "Most played"}</Link>
        <div className="w-full sm:ml-auto sm:w-auto">
          <RowFilter target="duo-list" placeholder={ko ? "원딜이나 서포터 이름으로 찾기" : "Find an ADC or support"} />
        </div>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            {ko ? "이 구간은 아직 조합별 게임이 충분하지 않아요. 6시간마다 새 게임이 추가돼요." : "Not enough games per pair in this rank yet. New games are added every 6 hours."}
          </p>
        ) : (
          <ul id="duo-list" className="divide-y divide-line">
            <li className="flex items-center gap-3 pb-2 text-xs text-muted">
              <span className="w-7" />
              <span className="flex-1">{ko ? "원딜 + 서포터" : "ADC + support"}</span>
              <span className="w-16 text-right">{ko ? "승률" : "Win rate"}</span>
              <span className="w-14 text-right">{ko ? "판수" : "Games"}</span>
            </li>
            {rows.map((r, i) => (
              <li
                key={`${r.adc}-${r.sup}`}
                data-filter={`${r.a.name}${altName.get(r.a.id) ?? ""}${r.a.id}${r.s.name}${altName.get(r.s.id) ?? ""}${r.s.id}`.toLowerCase().replace(/\s+/g, "")}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-7 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/champions/${r.a.id}?lane=bottom`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <Icon src={img.champion(version, r.a.image.full)} alt={r.a.name} size={36} className="rounded-md" />
                    <span className="truncate font-medium">{r.a.name}</span>
                  </Link>
                  <span className="text-muted" aria-hidden>+</span>
                  <Link href={`/champions/${r.s.id}?lane=support`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <Icon src={img.champion(version, r.s.image.full)} alt={r.s.name} size={36} className="rounded-md" />
                    <span className="truncate font-medium">{r.s.name}</span>
                  </Link>
                </span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums" style={{ color: r.wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                  {r.wr.toFixed(1)}%
                </span>
                <span className="w-14 text-right text-xs tabular-nums text-muted">{r.games.toLocaleString()}{ko ? "판" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
