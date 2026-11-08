import type { Metadata } from "next";
import Link from "@/components/Link";
import TierEmblem from "@/components/TierEmblem";
import { Icon, Panel } from "@/components/ui";
import { getChampions, img } from "@/lib/ddragon";
import { dict, ddLocale } from "@/lib/i18n";
import { laneLabel, parseServer, serverLabel, type Server } from "@/lib/lanes";
import { lookupLite, parseRiotId, RiotError, type LeagueEntry, type LookupError } from "@/lib/riot";
import { getLang, getServer, langAlternates } from "@/lib/server";
import { roles, toGames } from "@/lib/summoner";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string | string[]; s?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "멀티서치 (로비 5명 전적 한 번에)" : "Multi-search - your whole lobby at once",
    description: ko
      ? "챔피언 선택 로비 채팅을 그대로 붙여 넣으면 우리 팀 5명의 솔로랭크 티어, 최근 승률, 주 라인, 주 챔피언을 한 번에 보여줘요."
      : "Paste your champ select lobby chat and see all five teammates' solo queue rank, recent win rate, main role and champions at once.",
    alternates: await langAlternates("/multi"),
  };
}

// 로비 채팅 줄("Name #KR1님이 로비에 참가하셨습니다." / "Name #NA1 joined the lobby")이나 쉼표로 나눈 Riot ID에서 최대 5명
function parseLobby(text: string, server: Server) {
  const parts = text.includes("\n") ? text.split(/\r?\n/) : text.split(/[,，]/);
  const out: { gameName: string; tagLine: string }[] = [];
  const seen = new Set<string>();
  for (const raw of parts) {
    if (/나갔|left the lobby/i.test(raw)) continue;
    const s = raw
      .replace(/님이.*$/, "")
      .replace(/\s+(has\s+)?joined.*$/i, "")
      .replace(/(이\(가\)|\(이\)가)\s*(로비|방).*$/, "")
      .trim();
    const id = s ? parseRiotId(s, server) : null;
    if (!id) continue;
    const k = `${id.gameName}#${id.tagLine}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ gameName: id.gameName, tagLine: id.tagLine });
    if (out.length === 5) break;
  }
  return out;
}

const EXAMPLE = "Hide on bush #KR1님이 로비에 참가하셨습니다.\nT1 Gumayusi #KR1님이 로비에 참가하셨습니다.";

export default async function MultiPage({ searchParams }: Props) {
  const [sp, lang, cookieServer] = await Promise.all([searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const server = sp.s ? parseServer(sp.s) : cookieServer;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const people = parseLobby(q.slice(0, 2000), server);
  const t = dict(lang).summoner;

  const { version, champions } = people.length ? await getChampions(ddLocale(lang)) : { version: "", champions: [] };
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const results = await Promise.all(
    people.map(async (p) => {
      try {
        const r = await lookupLite(server, p.gameName, p.tagLine);
        return { ...p, ok: true as const, ...r };
      } catch (e) {
        return { ...p, ok: false as const, error: (e instanceof RiotError ? e.kind : "error") as LookupError };
      }
    }),
  );

  const errorText: Record<LookupError, string> = ko
    ? { "not-found": "소환사를 찾을 수 없어요. 이름과 태그를 확인해 주세요.", "rate-limited": "지금 조회가 몰려 있어요. 잠시 뒤 다시 눌러 주세요.", unavailable: "지금은 Riot 조회를 할 수 없어요.", error: "불러오지 못했어요. 다시 시도해 주세요." }
    : { "not-found": "Summoner not found. Check the name and tag.", "rate-limited": "Too many lookups right now. Try again in a moment.", unavailable: "Riot lookups are unavailable right now.", error: "Couldn't load. Please try again." };

  const rankText = (solo: LeagueEntry | null) => {
    if (!solo) return ko ? "언랭크" : "Unranked";
    const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier);
    return `${t.tiers[solo.tier as keyof typeof t.tiers] ?? solo.tier}${apex ? "" : ` ${solo.rank}`} · ${solo.leaguePoints} LP`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "멀티서치" : "Multi-search"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? `챔피언 선택 창의 채팅을 그대로 복사해 붙여 넣으면 ${serverLabel(server, lang)} 서버에서 우리 팀 5명을 한 번에 찾아요. 서버는 맨 위에서 바꿀 수 있어요.`
            : `Copy the chat from champ select and paste it here to look up all five teammates on ${serverLabel(server, lang)}. Change the server at the top of the page.`}
        </p>
      </div>
      <Panel>
        <form action="/multi" method="get" className="space-y-3">
          <input type="hidden" name="s" value={server} />
          <label htmlFor="multi-q" className="sr-only">
            {ko ? "로비 채팅 또는 Riot ID" : "Lobby chat or Riot IDs"}
          </label>
          <textarea
            id="multi-q"
            name="q"
            rows={5}
            defaultValue={q}
            placeholder={ko ? `${EXAMPLE}\n\n또는 이름#태그를 쉼표로 나눠서 입력` : "Faker #KR1 joined the lobby\nGumayusi #KR1 joined the lobby\n\nor Name#TAG, Name#TAG, ..."}
            className="w-full rounded-md border border-line bg-panel-2 p-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button type="submit" className="h-11 rounded-md bg-accent px-6 font-semibold text-black hover:brightness-110">
            {ko ? "5명 한 번에 검색" : "Search all"}
          </button>
        </form>
      </Panel>

      {q && people.length === 0 && (
        <p className="text-sm text-muted">{ko ? "붙여 넣은 글에서 소환사 이름을 찾지 못했어요." : "Couldn't find any summoner names in that text."}</p>
      )}

      {results.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {results.map((r) => {
            const href = `/summoner?id=${encodeURIComponent(`${r.gameName}#${r.tagLine}`)}&s=${server}`;
            const head = (
              <Link href={href} className="block min-w-0 hover:underline">
                <span className="block truncate font-bold">{r.gameName}</span>
                <span className="text-xs text-muted">#{r.tagLine}</span>
              </Link>
            );
            if (!r.ok)
              return (
                <Panel key={`${r.gameName}#${r.tagLine}`}>
                  {head}
                  <p className="mt-3 text-sm text-muted">{errorText[r.error]}</p>
                </Panel>
              );
            const games = toGames(r.matches, r.account.puuid);
            const wins = games.filter((g) => g.win).length;
            const k = games.reduce((s, g) => s + g.kills, 0);
            const d = games.reduce((s, g) => s + g.deaths, 0);
            const a = games.reduce((s, g) => s + g.assists, 0);
            const main = roles(games)[0];
            let streak = 0;
            while (streak < games.length && games[streak].win === games[0]?.win) streak++;
            const champs = [...games.reduce((m, g) => {
              const c = m.get(g.championId) ?? { id: g.championId, games: 0, wins: 0 };
              c.games++;
              if (g.win) c.wins++;
              return m.set(g.championId, c);
            }, new Map<number, { id: number; games: number; wins: number }>()).values()]
              .sort((x, y) => y.games - x.games)
              .slice(0, 3);
            const season = r.solo ? (r.solo.wins / Math.max(1, r.solo.wins + r.solo.losses)) * 100 : null;
            return (
              <Panel key={`${r.gameName}#${r.tagLine}`} className="space-y-3">
                {head}
                <div className="flex items-center gap-2">
                  <TierEmblem tier={r.solo?.tier ?? "UNRANKED"} size={40} />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{rankText(r.solo)}</p>
                    {r.solo && season !== null && (
                      <p className="text-xs text-muted">
                        {ko ? `시즌 ${r.solo.wins}승 ${r.solo.losses}패` : `Season ${r.solo.wins}W ${r.solo.losses}L`}{" "}
                        <span className={season >= 50 ? "text-win" : "text-lose"}>{season.toFixed(0)}%</span>
                      </p>
                    )}
                  </div>
                </div>
                {games.length === 0 ? (
                  <p className="text-sm text-muted">{ko ? "최근 솔로랭크 게임이 없어요." : "No recent solo queue games."}</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded bg-panel-2 p-2">
                        <dt className="text-[11px] text-muted">{ko ? `최근 ${games.length}판` : `Last ${games.length}`}</dt>
                        <dd className={wins * 2 >= games.length ? "font-bold text-win" : "font-bold text-lose"}>
                          {ko ? `${wins}승 ${games.length - wins}패` : `${wins}W ${games.length - wins}L`}
                        </dd>
                      </div>
                      <div className="rounded bg-panel-2 p-2">
                        <dt className="text-[11px] text-muted">KDA</dt>
                        <dd className="font-bold">{((k + a) / Math.max(1, d)).toFixed(2)}</dd>
                      </div>
                      <div className="rounded bg-panel-2 p-2">
                        <dt className="text-[11px] text-muted">{ko ? "주 라인" : "Main role"}</dt>
                        <dd className="font-bold">{main ? laneLabel(main.lane, lang) : "-"}</dd>
                      </div>
                      <div className="rounded bg-panel-2 p-2">
                        <dt className="text-[11px] text-muted">{ko ? "최근 흐름" : "Streak"}</dt>
                        <dd className={`font-bold ${streak >= 3 ? (games[0].win ? "text-win" : "text-lose") : ""}`}>
                          {streak >= 3
                            ? ko
                              ? `${streak}연${games[0].win ? "승" : "패"}`
                              : `${streak} ${games[0].win ? "wins" : "losses"} in a row`
                            : ko
                              ? "보통"
                              : "Mixed"}
                        </dd>
                      </div>
                    </dl>
                    <ul className="space-y-1.5">
                      {champs.map((c) => {
                        const champ = byKey.get(String(c.id));
                        return (
                          <li key={c.id} className="flex items-center gap-2 text-sm">
                            {champ && <Icon src={img.champion(version, champ.image.full)} alt={champ.name} size={28} className="rounded-md" />}
                            <span className="min-w-0 flex-1 truncate">{champ?.name ?? c.id}</span>
                            <span className="shrink-0 text-xs text-muted">
                              {ko ? `${c.games}판` : `${c.games}g`}{" "}
                              <span className={c.wins * 2 >= c.games ? "text-win" : "text-lose"}>{Math.round((c.wins / c.games) * 100)}%</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      {results.length > 0 && (
        <p className="text-xs text-muted">
          {ko ? "최근 솔로랭크 최대 8판 기준이에요. 자세한 전적은 이름을 누르세요." : "Based on up to 8 recent solo queue games. Click a name for the full profile."}
        </p>
      )}
    </div>
  );
}
