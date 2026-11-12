import { patchName, type Lane } from "@/lib/lanes";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Icon, Tabs, TierBadge, WinRate, pct } from "@/components/ui";
import { getChampions, getItems, getPatches, getRuneTrees, getSummonerSpells, img } from "@/lib/ddragon";
import BuildIcons from "@/components/BuildIcons";
import { quickBuild, realChamp } from "@/lib/real";
import {
  LANES,
  RANKS,
  parseLane,
  parseRank,
  laneLabel,
  rankLabel,
  serverLabel,
} from "@/lib/lanes";
import { ddLocale, dict, numLocale } from "@/lib/i18n";
import { getLang, getServer, langAlternates } from "@/lib/server";
import LivePanel from "@/components/LivePanel";
import AutoRefresh from "@/components/AutoRefresh";
import { boards } from "@/lib/stats";
import { latest as latestAll, rows as counterRows } from "@/lib/counters";

export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [lang, sp] = await Promise.all([getLang(), searchParams]);
  const ko = lang === "ko";
  // ?lane= 이 있으면 "탑 티어"처럼 라인별 검색어에 맞춘 제목과 제 주소(canonical)를 써요
  const ln = LANES.find((l) => l.id === sp.lane)?.id;
  const name = ln ? laneLabel(ln, lang) : "";
  // "26.22 패치 티어" 검색과 링크 미리보기에 이번 패치 번호와 실제 1위 챔피언이 바로 보이게 해요 (실제 데이터가 없으면 일반 문구)
  let pn = "";
  let facts = "";
  try {
    const [{ champions }, allPatches, server] = await Promise.all([getChampions(ddLocale(lang)), getPatches(), getServer()]);
    const top = (lane: Lane) => {
      const b = boards(champions, lane, { server, rank: "all" }, allPatches);
      if (b.source !== "real") return null;
      const rows = b.boards[b.boards.length - 1] ?? []; // 화면의 순위표와 같은 순서
      return rows.length ? { patch: b.patches[b.patches.length - 1], rows } : null;
    };
    if (ln) {
      const r = top(ln);
      if (r) {
        pn = patchName(r.patch);
        const [a, ...rest] = r.rows.slice(0, 3);
        const others = rest.map((x) => x.champion.name).join(", ");
        facts = ko
          ? `${pn} 패치 ${name} 1위는 ${a.champion.name} (승률 ${a.winRate.toFixed(1)}%)${others ? `, 그다음은 ${others}` : ""}. `
          : `Patch ${pn} ${name} #1: ${a.champion.name} (${a.winRate.toFixed(1)}% win rate)${others ? `, then ${others}` : ""}. `;
      }
    } else {
      const firsts = LANES.flatMap((l) => {
        const r = top(l.id);
        if (!r) return [];
        pn = patchName(r.patch);
        return [`${laneLabel(l.id, lang)} ${r.rows[0].champion.name}`];
      });
      if (firsts.length) facts = ko ? `${pn} 패치 라인별 1위: ${firsts.join(", ")}. ` : `Patch ${pn} #1 picks: ${firsts.join(", ")}. `;
    }
  } catch {
    // 숫자를 못 읽으면 일반 문구만 써요
  }
  const pre = pn ? (ko ? `${pn} 패치 ` : `Patch ${pn} `) : "";
  return {
    title: ln ? (ko ? `${pre}${name} 티어 리스트 (롤 ${name} 티어 순위)` : `${pre}${name} Tier List - best ${name} champions`) : `${pre}${dict(lang).tierTitle}`,
    description:
      facts +
      (ln
        ? ko
          ? `이번 패치 ${name} 챔피언 티어 순위. 실제 랭크 게임 승률, 픽률, 밴률과 추천 룬·코어템을 한 줄에 보여줘요.`
          : `Best ${name} champions this patch, ranked from real ranked games with win, pick and ban rates plus runes and core items.`
        : ko
          ? "라인별 챔피언 티어표. 승률, 픽률, 밴률을 이번 패치 기준으로 보여줘요."
          : "Champion tier list by lane with win, pick and ban rates for the current patch."),
    alternates: await langAlternates(ln ? `/tier?lane=${ln}` : "/tier"),
  };
}

type Props = {
  searchParams: Promise<{ lane?: string; rank?: string; patch?: string }>;
};

export default async function TierPage({ searchParams }: Props) {
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
  // 바로 전 패치 승률 (버프·너프 체감용). 두 패치 모두 200판 이상일 때만 화살표를 보여요
  const prevRows = patches.indexOf(patch) > 0 ? bs[patches.indexOf(patch) - 1] : [];
  const prevWr = new Map(prevRows.filter((s) => s.games >= 200).map((s) => [s.champion.id, s.winRate] as const));
  const prevPatch = patches.indexOf(patch) > 0 ? patches[patches.indexOf(patch) - 1] : null;
  // 표 오른쪽에 "지금 이 챔피언이 가는 룬·스펠·코어템"을 같이 보여줍니다 (lol.ps처럼 한 줄에 다 보이게)
  const [items, trees, spells] =
    source === "real"
      ? await Promise.all([
          getItems(version, ddLocale(lang)),
          getRuneTrees(version, ddLocale(lang)),
          getSummonerSpells(version, ddLocale(lang)),
        ]).catch(() => [null, null, null] as const)
      : ([null, null, null] as const);
  const quick = new Map(
    rows.flatMap((s) => {
      const d = real.get(patch);
      const c = d && items && trees && spells ? realChamp(d, s.champion, lane) : null;
      return c && items && trees && spells ? [[s.champion.id, quickBuild(c, items, trees, spells)] as const] : [];
    }),
  );
  // 챔피언마다 가장 까다로운 상대 3명 (u.gg 티어 목록의 "카운터" 칸처럼). 표본이 많은 에메랄드+ 전체 데이터로
  const allData = latestAll(server);
  const counters = new Map(rows.map((s) => [s.champion.id, allData ? (counterRows(allData, s.champion, lane, champions)?.counters.slice(0, 3) ?? []) : []]));
  const q = (o: { lane?: string; rank?: string; patch?: string }) =>
    `/tier?lane=${o.lane ?? lane}&rank=${o.rank ?? rank}${(o.patch ?? patch) !== latest ? `&patch=${o.patch ?? patch}` : ""}`;

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-2xl font-bold">{t.tierTitle}</h1>
            <span className="text-sm text-muted">
              {t.patch(patch)} · {t.serverName(serverLabel(server, lang))} ·{" "}
              {rankLabel(rank, lang)} ·{" "}
              {source === "real"
                ? t.soloGames(real.get(patch)!.matches.toLocaleString(numLocale(lang)))
                : t.sampleData}
            </span>
          </div>

          <div className="space-y-2">
            <Tabs
              active={lane}
              items={LANES.map((l) => ({
                id: l.id,
                label: laneLabel(l.id, lang),
                href: q({ lane: l.id }),
              }))}
            />
            <Tabs
              active={rank}
              items={RANKS.map((r) => ({
                id: r.id,
                label: rankLabel(r.id, lang),
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
                    label: t.patch(p),
                    href: q({ patch: p }),
                  }))}
              />
            )}
          </div>
        </div>
        <LivePanel server={server} lang={lang} />
      </div>

      <div className="overflow-x-auto rounded-lg bg-panel">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">{t.rank}</th>
              <th className="px-3 py-2 text-left">{t.champion}</th>
              <th className="px-3 py-2">{t.tierCol}</th>
              <th className="px-3 py-2 text-left">{lang === "ko" ? "룬 · 스펠 · 코어템" : "Runes · Spells · Core items"}</th>
              <th className="px-3 py-2 text-left">{lang === "ko" ? "카운터" : "Counters"}</th>
              <th className="px-3 py-2 text-right">{t.metaScore}</th>
              <th className="px-3 py-2 text-right">{t.winRate}</th>
              <th className="px-3 py-2 text-right">{t.pickRate}</th>
              <th className="px-3 py-2 text-right">{t.banRate}</th>
              <th className="px-3 py-2 text-right">{t.gamesCol}</th>
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
                  <TierBadge tier={s.tier} lang={lang} />
                </td>
                <td className="px-3 py-2">
                  {quick.get(s.champion.id) && <BuildIcons qb={quick.get(s.champion.id)!} version={version} size={26} />}
                </td>
                <td className="px-3 py-2">
                  {(counters.get(s.champion.id)?.length ?? 0) > 0 && (
                    <Link
                      href={`/champions/${s.champion.id}/counters?lane=${lane}`}
                      className="flex items-center gap-1 hover:opacity-80"
                      title={lang === "ko" ? `${s.champion.name} 카운터 전체 보기` : `All ${s.champion.name} counters`}
                    >
                      {counters.get(s.champion.id)!.map((m) => (
                        <Icon key={m.champion.id} src={img.champion(version, m.champion.image.full)} alt={m.champion.name} size={24} />
                      ))}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {s.score.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right">
                  <WinRate value={s.winRate} />
                  {s.games >= 200 && prevWr.has(s.champion.id) && (() => {
                    const d = s.winRate - prevWr.get(s.champion.id)!;
                    if (Math.abs(d) < 0.5) return null;
                    return (
                      <span
                        className={`block text-[11px] tabular-nums ${d > 0 ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}
                        title={lang === "ko" ? `${patchName(prevPatch)} 패치 대비` : `vs patch ${patchName(prevPatch)}`}
                      >
                        {d > 0 ? "▲" : "▼"}
                        {Math.abs(d).toFixed(1)}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right">{pct(s.pickRate)}</td>
                <td className="px-3 py-2 text-right">{pct(s.banRate)}</td>
                <td className={`px-3 py-2 text-right ${s.games < 30 ? "text-amber-400" : "text-muted"}`} title={s.games < 30 ? t.lowSampleTip : undefined}>
                  {s.games < 30 && "⚠ "}
                  {s.games.toLocaleString(numLocale(lang))}
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
