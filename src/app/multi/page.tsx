import type { Metadata } from "next";
import Link from "@/components/Link";
import TierEmblem from "@/components/TierEmblem";
import { Icon, Panel } from "@/components/ui";
import { getChampions, img } from "@/lib/ddragon";
import { dict, ddLocale } from "@/lib/i18n";
import { laneLabel, parseServer, serverLabel, SERVERS, type Lane, type Server } from "@/lib/lanes";
import { loadRealData } from "@/lib/real";
import { lookupLite, parseRiotId, RiotError, type LeagueEntry, type LookupError } from "@/lib/riot";
import { getLang, getServer, langAlternates } from "@/lib/server";
import { roles, toGames } from "@/lib/summoner";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string | string[]; s?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, lang, cookieServer] = await Promise.all([searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const names = q ? parseLobby(q.slice(0, 2000), sp.s ? parseServer(sp.s) : cookieServer).map((p) => p.gameName) : [];
  // 검색 결과 주소는 공유용 제목만 바꾸고 검색엔진에는 올리지 않아요 (빈 페이지만 색인)
  const who = names.length > 2 ? (ko ? `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}명` : `${names.slice(0, 2).join(", ")} +${names.length - 2}`) : names.join(", ");
  return {
    title: who ? (ko ? `${who} - 멀티서치` : `${who} - Multi-search`) : ko ? "멀티서치 (로비 5명 전적 한 번에)" : "Multi-search - your whole lobby at once",
    description: ko
      ? "챔피언 선택 로비 채팅을 그대로 붙여 넣으면 우리 팀 5명의 솔로랭크 티어, 최근 승률, 주 라인, 주 챔피언과 팀 맞춤 밴 추천을 한 번에 보여줘요."
      : "Paste your champ select lobby chat and see all five teammates' solo queue rank, recent win rate, main role, champions and bans for your team at once.",
    alternates: await langAlternates("/multi"),
    ...(names.length ? { robots: { index: false, follow: true } } : {}),
  };
}

// 로비 채팅 줄("Name #KR1님이 로비에 참가하셨습니다." / "Name #NA1 joined the lobby")이나 쉼표로 나눈 Riot ID에서 최대 5명
function parseLobby(text: string, server: Server) {
  // 한 줄 입력창에 붙여 넣으면 줄바꿈이 사라져서, 참가 문구 뒤에서 다시 나눠요
  const lined = text.replace(/(참가하셨습니다\.?|참가했습니다\.?|joined the lobby\.?|left the lobby\.?|나갔습니다\.?)/gi, "$1\n");
  const parts = lined.includes("\n") ? lined.split(/\r?\n/) : lined.split(/[,，]/);
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

// 우리 팀 각자 주 라인의 주 챔피언이 이번 패치에 어려워하는 상대를 모아 밴 후보로 (상대별 게임 수가 적어 내 평균 쪽으로 20판 가중, 15판 이상만)
type Pick = { who: string; key: string; lane: Lane };
function teamBans(picks: Pick[], server: Server) {
  const real = loadRealData({ server, rank: "all" });
  const patch = [...real.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).pop();
  const data = patch ? real.get(patch) : undefined;
  if (!data) return [];
  const out = new Map<string, { key: string; edge: number; why: { who: string; mine: string; winRate: number; games: number }[] }>();
  for (const p of picks) {
    const c = data.champs[`${p.key}:${p.lane}`];
    if (!c || c.games < 30) continue;
    const base = c.wins / c.games;
    const hard = Object.entries(c.vs)
      .filter(([k, [g]]) => g >= 15 && k !== p.key)
      .map(([k, [g, w]]) => ({ k, g, w, edge: base - (w + base * 20) / (g + 20) }))
      .filter((m) => m.edge > 0.015)
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 2);
    for (const m of hard) {
      const cur = out.get(m.k) ?? { key: m.k, edge: 0, why: [] };
      cur.edge += m.edge;
      cur.why.push({ who: p.who, mine: p.key, winRate: (m.w / m.g) * 100, games: m.g });
      out.set(m.k, cur);
    }
  }
  return [...out.values()].sort((a, b) => b.edge - a.edge).slice(0, 3);
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

  const picks: Pick[] = [];
  for (const r of results) {
    if (!r.ok) continue;
    const games = toGames(r.matches, r.account.puuid);
    const lane = roles(games)[0]?.lane;
    if (!lane) continue;
    const counts = new Map<number, number>();
    for (const g of games) if (g.lane === lane) counts.set(g.championId, (counts.get(g.championId) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (top) picks.push({ who: r.gameName, key: String(top[0]), lane });
  }
  const bans = picks.length ? teamBans(picks, server) : [];

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
            ? `챔피언 선택 창의 채팅을 그대로 복사해 붙여 넣으면 ${serverLabel(server, lang)} 서버에서 우리 팀 5명을 한 번에 찾아요. 서버는 아래에서 고를 수 있어요.`
            : `Copy the chat from champ select and paste it here to look up all five teammates on ${serverLabel(server, lang)}. Pick the server below.`}
        </p>
      </div>
      <Panel>
        <form action="/multi" method="get" className="space-y-3">
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">{ko ? "서버" : "Server"}</legend>
            <span className="text-xs text-muted">{ko ? "서버" : "Server"}</span>
            {SERVERS.map(({ id }) => (
              <label key={id} className="cursor-pointer">
                <input type="radio" name="s" value={id} defaultChecked={id === server} className="peer sr-only" />
                <span className="inline-block rounded-md border border-line px-3 py-1 text-sm peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {serverLabel(id, lang)}
                </span>
              </label>
            ))}
          </fieldset>
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
      {bans.length > 0 && (
        <Panel title={ko ? "우리 팀 기준 밴 추천" : "Bans for your team"}>
          <p className="mb-3 text-xs text-muted">
            {ko
              ? "팀원마다 주 라인에서 가장 많이 한 챔피언이 이번 패치 실제 게임에서 특히 약했던 상대예요."
              : "Champions that each teammate's most-played pick in their main role struggles against this patch, from real games."}
          </p>
          <ol className="grid gap-3 sm:grid-cols-3">
            {bans.map((b) => {
              const enemy = byKey.get(b.key);
              return (
                <li key={b.key} className="flex gap-3 rounded-lg bg-panel-2 p-3">
                  {enemy && <Icon src={img.champion(version, enemy.image.full)} alt={enemy.name} size={48} className="rounded-lg" />}
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">{enemy?.name ?? b.key}</p>
                    {b.why.map((w) => (
                      <p key={w.who} className="text-xs text-muted">
                        {ko
                          ? `${w.who}의 ${byKey.get(w.mine)?.name ?? w.mine} 상대 승률 `
                          : `${w.who}'s ${byKey.get(w.mine)?.name ?? w.mine} wins `}
                        <span className="text-lose">{w.winRate.toFixed(0)}%</span>
                        {ko ? ` (${w.games}판)` : ` (${w.games} games)`}
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
      {results.length > 0 && (
        <p className="text-xs text-muted">
          {ko ? "최근 솔로랭크 최대 8판 기준이에요. 자세한 전적은 이름을 누르세요." : "Based on up to 8 recent solo queue games. Click a name for the full profile."}
        </p>
      )}
    </div>
  );
}
