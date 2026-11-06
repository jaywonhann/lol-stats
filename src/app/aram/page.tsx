import type { Metadata } from "next";
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang, langAlternates } from "@/lib/server";
import RowFilter from "@/components/RowFilter";
import { ARAM_MODES, loadAram, MIN_ARAM_GAMES, modeName, parseMode, type AramMode } from "@/lib/aram";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ mode?: string; sort?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  const mode = parseMode((await searchParams).mode, !!loadAram().matches.mayhem);
  const name = modeName(mode, ko);
  return {
    title: ko ? `${name} 챔피언 티어 · 템트리 · ${mode === "mayhem" ? "증강 승률" : "룬"}` : `${name} tier list, builds${mode === "mayhem" ? " and augments" : " and runes"}`,
    description: ko
      ? `실제 ${name} 게임으로 집계한 챔피언 승률 순위와 챔피언별 템트리, 증강 추천.`
      : `Champion win rates from real ${name} games, with item builds and augment picks for every champion.`,
    alternates: await langAlternates(`/aram?mode=${mode}`),
  };
}

export default async function AramPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await getLang();
  const ko = lang === "ko";
  const data = loadAram();
  const mode = parseMode(sp.mode, !!data.matches.mayhem);
  const sort = sp.sort === "pick" ? "pick" : "wr";
  const [{ version, champions }, alt] = await Promise.all([
    getChampions(ddLocale(lang)),
    getChampions(ddLocale(ko ? "en" : "ko")).then((r) => r.champions).catch(() => []),
  ]);
  const altName = new Map(alt.map((c) => [c.id, c.name]));
  const total = data.matches[mode] ?? 0;
  const rows = champions
    .map((c) => ({ c, a: data.champs[`${mode}:${c.key}`] }))
    .filter((r) => r.a && r.a.games >= MIN_ARAM_GAMES)
    .map(({ c, a }) => ({ c, games: a!.games, wr: (a!.wins / a!.games) * 100, pick: (a!.games / Math.max(1, total)) * 100, score: (a!.wins + 10) / (a!.games + 20) }))
    .sort((a, b) => (sort === "pick" ? b.games - a.games : b.score - a.score));
  const tab = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-accent font-semibold text-bg" : "bg-panel-2 text-muted hover:text-text"}`;
  const q = (m: AramMode, s: string) => `/aram?${new URLSearchParams({ mode: m, ...(s === "pick" ? { sort: s } : {}) })}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? `${modeName(mode, true)} 챔피언 순위` : `${modeName(mode, false)} champion tier list`}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? `한국·북미·유럽 서버의 실제 ${modeName(mode, true)} ${total.toLocaleString()}게임 (패치 ${data.patch ?? "-"}). 챔피언을 누르면 템트리${mode === "mayhem" ? "와 증강" : ""}이 나와요.`
            : `${total.toLocaleString()} real ${modeName(mode, false)} games from KR, NA and EUW (patch ${data.patch ?? "-"}). Pick a champion for builds${mode === "mayhem" ? " and augments" : ""}.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ARAM_MODES.map((m) => (
          <Link key={m} href={q(m, sort)} className={tab(mode === m)}>{modeName(m, ko)}</Link>
        ))}
        <span className="mx-1 w-px bg-line" aria-hidden />
        <Link href={q(mode, "wr")} className={tab(sort === "wr")}>{ko ? "승률 순" : "Win rate"}</Link>
        <Link href={q(mode, "pick")} className={tab(sort === "pick")}>{ko ? "많이 하는 순" : "Most played"}</Link>
        <div className="w-full sm:ml-auto sm:w-auto">
          <RowFilter target="aram-list" placeholder={ko ? "챔피언 이름으로 찾기" : "Find a champion"} />
        </div>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            {mode === "mayhem"
              ? ko
                ? "지금은 증바람이 열려 있지 않아서 게임이 없어요. 증바람이 다시 열리면 자동으로 모아서 보여드려요. 그동안 칼바람 탭을 봐 주세요."
                : "ARAM: Mayhem isn't live right now, so there are no games. We'll collect it automatically when it returns. Try the ARAM tab meanwhile."
              : ko
                ? "데이터를 모으는 중이에요. 6시간마다 새 게임이 추가돼요."
                : "Collecting games now. New games are added every 6 hours."}
          </p>
        ) : (
          <ul id="aram-list" className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.c.id} data-filter={`${r.c.name}${altName.get(r.c.id) ?? ""}${r.c.id}`.toLowerCase().replace(/\s+/g, "")}>
                <Link href={`/aram/${r.c.id}?mode=${mode}`} className="flex items-center gap-3 py-2 hover:bg-panel-2">
                  <span className="w-7 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                  <Icon src={img.champion(version, r.c.image.full)} alt={r.c.name} size={36} className="rounded-md" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.c.name}</span>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums" style={{ color: r.wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                    {r.wr.toFixed(1)}%
                  </span>
                  <span className="hidden w-16 text-right text-xs tabular-nums text-muted sm:block">{r.pick.toFixed(1)}%</span>
                  <span className="w-14 text-right text-xs tabular-nums text-muted">{r.games.toLocaleString()}{ko ? "판" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
