import { patchName } from "@/lib/lanes";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES, laneLabel, rankLabel, serverLabel, type Lane } from "@/lib/lanes";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer, langAlternates } from "@/lib/server";
import { boards } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "밴 추천 (이번 패치 롤 밴 챔피언)" : "Ban recommendations - who to ban this patch",
    description: ko
      ? "실제 랭크 게임 승률과 픽률로 고른 라인별 밴 추천 챔피언, 그리고 많이 밴되지만 승률은 낮은 '밴 낭비' 챔피언."
      : "Champions worth banning per lane from real ranked games, plus popular bans that don't actually win much.",
    alternates: await langAlternates("/bans"),
  };
}

type Row = { id: string; name: string; icon: string; lane: Lane; winRate: number; pickRate: number; banRate: number; games: number };

// 밴 가치: 50%보다 얼마나 더 이기는지 × 얼마나 자주 만나는지(픽률의 제곱근, 너무 인기만으로 1등 하지 않게)
const threat = (r: Row) => (r.winRate - 50) * Math.sqrt(r.pickRate);
const MIN_GAMES = 100;

export default async function BansPage() {
  const [lang, server] = await Promise.all([getLang(), getServer()]);
  const ko = lang === "ko";
  const [{ version, champions }, allPatches] = await Promise.all([getChampions(ddLocale(lang)), getPatches()]);
  const filter = { server, rank: "all" as const };

  let patch = "";
  let source = "mock";
  const byLane = new Map<Lane, Row[]>();
  for (const { id: lane } of LANES) {
    const b = boards(champions, lane, filter, allPatches);
    source = b.source;
    patch = b.patches[b.patches.length - 1];
    const rows = (b.boards[b.boards.length - 1] ?? [])
      .filter((s) => s.games >= MIN_GAMES)
      .map((s) => ({
        id: s.champion.id,
        name: s.champion.name,
        icon: img.champion(version, s.champion.image.full),
        lane,
        winRate: s.winRate,
        pickRate: s.pickRate,
        banRate: s.banRate,
        games: s.games,
      }));
    byLane.set(lane, rows);
  }

  // 챔피언마다 판수가 가장 많은 라인 하나로 (밴은 라인과 상관없이 하니까)
  const main = new Map<string, Row>();
  for (const rows of byLane.values())
    for (const r of rows) if (!main.has(r.id) || main.get(r.id)!.games < r.games) main.set(r.id, r);
  const all = [...main.values()];
  const top = all.filter((r) => r.winRate > 50).sort((a, b) => threat(b) - threat(a)).slice(0, 10);
  const wasted = all.filter((r) => r.banRate >= 5 && r.winRate < 50).sort((a, b) => b.banRate - a.banRate).slice(0, 6);

  const pct = (n: number) => `${n.toFixed(1)}%`;
  // compact: 라인별 작은 칸이라 라인 이름과 밴율은 빼고 이름이 잘리지 않게
  const line = (r: Row, i: number, compact = false) => (
    <li key={`${r.lane}-${r.id}`} className="flex items-center gap-3 py-2 text-sm">
      <span className="w-5 shrink-0 text-right font-bold text-muted">{i + 1}</span>
      <Icon src={r.icon} alt={r.name} size={36} className="rounded-md" />
      <Link href={`/champions/${r.id}?lane=${r.lane}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
        {r.name}
        {!compact && <span className="ml-1 text-xs font-normal text-muted">{laneLabel(r.lane, lang)}</span>}
      </Link>
      <span className="w-16 shrink-0 text-right">
        <span className={r.winRate >= 50 ? "text-win" : "text-lose"}>{pct(r.winRate)}</span>
        <span className="block text-[11px] text-muted">{ko ? "승률" : "win"}</span>
      </span>
      <span className="w-14 shrink-0 text-right">
        {pct(r.pickRate)}
        <span className="block text-[11px] text-muted">{ko ? "픽률" : "pick"}</span>
      </span>
      {!compact && (
      <span className="hidden w-14 shrink-0 text-right sm:block">
        {pct(r.banRate)}
        <span className="block text-[11px] text-muted">{ko ? "밴율" : "ban"}</span>
      </span>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "밴 추천" : "Who to ban"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? `패치 ${patchName(patch)} · ${serverLabel(server, lang)} ${rankLabel("all", lang)} 실제 랭크 게임. 승률이 50%보다 높고 자주 나오는 챔피언일수록 위에 와요 (${MIN_GAMES}판 이상만).`
            : `Patch ${patchName(patch)} · ${serverLabel(server, lang)} ${rankLabel("all", lang)} ranked games. Champions that win more than 50% and show up often rank higher (${MIN_GAMES}+ games only).`}
        </p>
      </div>
      {source !== "real" ? (
        <Panel>
          <p className="text-sm text-muted">{ko ? "아직 이번 패치 데이터가 모이는 중이에요." : "Still collecting games for this patch."}</p>
        </Panel>
      ) : (
        <>
          <Panel title={ko ? "지금 밴하면 좋은 챔피언 TOP 10" : "Top 10 bans right now"}>
            <ol className="divide-y divide-line">{top.map((r, i) => line(r, i))}</ol>
          </Panel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {LANES.map(({ id: lane }) => {
              const rows = (byLane.get(lane) ?? []).filter((r) => r.winRate > 50).sort((a, b) => threat(b) - threat(a)).slice(0, 5);
              return (
                <Panel key={lane} title={ko ? `${laneLabel(lane, lang)} 밴 추천` : `${laneLabel(lane, lang)} bans`}>
                  {rows.length ? (
                    <ol className="divide-y divide-line">{rows.map((r, i) => line(r, i, true))}</ol>
                  ) : (
                    <p className="text-sm text-muted">{ko ? "표본이 충분한 챔피언이 아직 없어요." : "Not enough games yet."}</p>
                  )}
                </Panel>
              );
            })}
          </div>
          {wasted.length > 0 && (
            <Panel title={ko ? "밴 낭비일 수도 있는 챔피언" : "Bans you might be wasting"}>
              <p className="mb-2 text-xs text-muted">
                {ko ? "많이 밴되지만(5% 이상) 실제 승률은 50%가 안 되는 챔피언이에요." : "Banned 5%+ of games but winning under 50% when picked."}
              </p>
              <ol className="divide-y divide-line">{wasted.map((r, i) => line(r, i))}</ol>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
