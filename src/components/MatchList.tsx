// 최근 게임 목록: 한 줄 요약을 누르면 10명 전체 KDA·딜량·아이템·인분이 펼쳐져요
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { img, type Champion } from "@/lib/ddragon";
import type { Lang } from "@/lib/i18n";
import type { Match, Participant } from "@/lib/riot";
import { rateMatch } from "@/lib/score";

const T = {
  ko: {
    title: "최근 게임",
    hint: "게임을 누르면 10명 전체 기록이 펼쳐져요.",
    win: "승",
    loss: "패",
    blue: "블루팀",
    red: "레드팀",
    dmg: "딜량",
    inbun: (v: string) => `${v}인분`,
    ago: (h: number) => (h < 1 ? "방금 전" : h < 48 ? `${Math.round(h)}시간 전` : `${Math.round(h / 24)}일 전`),
    cs: "CS",
    min: (m: number) => `${m}분`,
    victory: "승리",
    defeat: "패배",
    solo: "솔랭",
    rank: (n: number) => `${n}위`,
    kp: (v: number) => `킬관여 ${v}%`,
    csMin: (v: string) => `분당 ${v} CS`,
    kda: "KDA",
  },
  en: {
    title: "Recent games",
    hint: "Tap a game to see all 10 players.",
    win: "W",
    loss: "L",
    blue: "Blue team",
    red: "Red team",
    dmg: "Damage",
    inbun: (v: string) => `${v}x`,
    ago: (h: number) => (h < 1 ? "just now" : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`),
    cs: "CS",
    min: (m: number) => `${m}m`,
    victory: "Victory",
    defeat: "Defeat",
    solo: "Ranked Solo",
    rank: (n: number) => `#${n}`,
    kp: (v: number) => `KP ${v}%`,
    csMin: (v: string) => `${v} CS/m`,
    kda: "KDA",
  },
};

const items = (p: Participant) => [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
const cs = (p: Participant) => p.totalMinionsKilled + p.neutralMinionsKilled;
const kdaOf = (p: Participant) => (p.deaths ? (p.kills + p.assists) / p.deaths : p.kills + p.assists).toFixed(2);

export default function MatchList({
  matches,
  puuid,
  version,
  champions,
  lang,
  spellIcons = {},
  runeIcons = {},
}: {
  matches: Match[];
  puuid: string;
  version: string | null;
  champions: Champion[];
  lang: Lang;
  spellIcons?: Record<number, string>;
  runeIcons?: Record<number, string>;
}) {
  const t = T[lang];
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const champIcon = (p: Participant, size: number) =>
    version ? (
      <Icon src={img.champion(version, byKey.get(String(p.championId))?.image.full ?? `${p.championName}.png`)} alt={p.championName} size={size} />
    ) : (
      <span className="shrink-0 rounded bg-panel-2" style={{ width: size, height: size }} />
    );
  const itemRow = (p: Participant, size: number) => (
    <span className="flex gap-0.5">
      {items(p).map((id, i) =>
        id && version ? (
          <Icon key={i} src={img.item(version, String(id))} alt="" size={size} />
        ) : (
          <span key={i} className="rounded bg-panel-2" style={{ width: size, height: size }} />
        ),
      )}
    </span>
  );

  const rows = matches
    .filter((m) => m.info.gameDuration >= 300 && m.info.participants.some((p) => p.puuid === puuid))
    .slice(0, 20);
  if (!rows.length) return null;

  return (
    <Panel title={t.title}>
      <p className="mb-2 text-xs text-muted">{t.hint}</p>
      <ul className="space-y-2">
        {rows.map((m) => {
          const me = m.info.participants.find((p) => p.puuid === puuid)!;
          const rated = new Map(rateMatch(m).map((r) => [r.puuid, r.inbun]));
          const minutes = Math.round(m.info.gameDuration / 60);
          const hours = (Date.now() - (m.info.gameEndTimestamp ?? m.info.gameCreation)) / 3_600_000;
          const maxDmg = Math.max(...m.info.participants.map((p) => p.totalDamageDealtToChampions), 1);
          const win = me.win;
          const ratedList = rateMatch(m).sort((a, b) => b.inbun - a.inbun);
          const myInbun = rated.get(puuid) ?? 1;
          const myRank = Math.max(1, ratedList.findIndex((r) => r.puuid === puuid) + 1);
          const teamKills = m.info.participants.filter((p) => p.teamId === me.teamId).reduce((a, p) => a + p.kills, 0);
          const kp = teamKills ? Math.round(((me.kills + me.assists) / teamKills) * 100) : 0;
          return (
            <li key={m.metadata.matchId}>
              <details className="group rounded-lg bg-panel">
                <summary
                  className={`grid cursor-pointer list-none grid-cols-[4.5rem_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-lg px-3 py-3 [&::-webkit-details-marker]:hidden md:grid-cols-[4.5rem_auto_6.5rem_7.5rem_minmax(0,1fr)] xl:grid-cols-[4.5rem_auto_6.5rem_7.5rem_auto_minmax(0,1fr)] ${win ? "bg-[color-mix(in_srgb,var(--chart-up)_14%,var(--color-panel))]" : "bg-[color-mix(in_srgb,var(--chart-down)_14%,var(--color-panel))]"}`}
                >
                  <div className="leading-tight">
                    <p className="text-sm font-bold" style={{ color: win ? "var(--chart-up)" : "var(--chart-down)" }}>
                      {win ? t.victory : t.defeat}
                    </p>
                    <p className="text-xs text-muted">{t.solo}</p>
                    <p className="text-xs text-muted">{t.min(minutes)}</p>
                    <p className="text-xs text-muted">{t.ago(hours)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="relative">
                      {champIcon(me, 48)}
                      {me.champLevel && (
                        <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">{me.champLevel}</span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {[me.summoner1Id, me.summoner2Id].map((id, i) =>
                        id && spellIcons[id] ? <Icon key={i} src={spellIcons[id]} alt="" size={22} /> : <span key={i} className="h-[22px] w-[22px] rounded bg-panel-2" />,
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {[me.perks?.styles[0]?.selections[0]?.perk, me.perks?.styles[1]?.style].map((id, i) =>
                        id && runeIcons[id] ? (
                          <Icon key={i} src={runeIcons[id]} alt="" size={22} className="rounded-full bg-bg" />
                        ) : (
                          <span key={i} className="h-[22px] w-[22px] rounded-full bg-panel-2" />
                        ),
                      )}
                    </span>
                  </div>
                  <div className="text-center leading-tight">
                    <p className="whitespace-nowrap text-base font-bold tabular-nums">
                      {me.kills} / <span style={{ color: "var(--chart-down)" }}>{me.deaths}</span> / {me.assists}
                    </p>
                    <p className="text-xs text-muted">
                      {kdaOf(me)} {t.kda}
                    </p>
                  </div>
                  <div className="col-span-3 flex flex-wrap items-center gap-x-3 text-xs text-muted md:col-span-1 md:block md:space-y-0.5">
                    <p>
                      <span className="font-bold text-accent">{t.inbun(myInbun.toFixed(1))}</span> {t.rank(myRank)}
                    </p>
                    <p>{t.kp(kp)}</p>
                    <p>{t.csMin((cs(me) / Math.max(1, m.info.gameDuration / 60)).toFixed(1))}</p>
                  </div>
                  <div className="col-span-3 md:col-span-1">{itemRow(me, 24)}</div>
                  <div className="hidden grid-cols-2 gap-x-3 gap-y-0.5 xl:grid">
                    {[100, 200].map((team) => (
                      <ul key={team} className="space-y-0.5">
                        {m.info.participants
                          .filter((p) => p.teamId === team)
                          .map((p) => (
                            <li key={p.puuid} className="flex items-center gap-1 text-xs">
                              {champIcon(p, 16)}
                              <span className={`max-w-[5.5rem] truncate ${p.puuid === puuid ? "font-bold text-text" : "text-muted"}`}>
                                {p.riotIdGameName ?? p.championName}
                              </span>
                            </li>
                          ))}
                      </ul>
                    ))}
                  </div>
                </summary>
                <div className="grid gap-3 border-t border-line p-3 md:grid-cols-2">
                  {[100, 200].map((team) => (
                    <div key={team}>
                      <p className="mb-1 text-xs font-semibold text-muted">
                        {team === 100 ? t.blue : t.red} · {m.info.participants.find((p) => p.teamId === team)?.win ? t.win : t.loss}
                      </p>
                      <ul className="space-y-1.5">
                        {m.info.participants
                          .filter((p) => p.teamId === team)
                          .map((p) => {
                            const id = p.riotIdGameName ? `${p.riotIdGameName}#${p.riotIdTagline ?? ""}` : null;
                            return (
                              <li key={p.puuid} className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${p.puuid === puuid ? "bg-accent/10" : ""}`}>
                                {champIcon(p, 24)}
                                <span className="min-w-0 flex-1">
                                  {id ? (
                                    <Link href={`/summoner?id=${encodeURIComponent(id)}`} className="block truncate hover:underline">
                                      {p.riotIdGameName}
                                    </Link>
                                  ) : (
                                    <span className="block truncate">{p.championName}</span>
                                  )}
                                  <span className="block h-1 rounded bg-panel-2">
                                    <span
                                      className="block h-1 rounded bg-accent"
                                      style={{ width: `${(p.totalDamageDealtToChampions / maxDmg) * 100}%` }}
                                      title={`${t.dmg} ${p.totalDamageDealtToChampions.toLocaleString()}`}
                                    />
                                  </span>
                                </span>
                                <span className="w-14 shrink-0 text-right font-semibold">
                                  {p.kills}/{p.deaths}/{p.assists}
                                </span>
                                <span className="hidden w-9 shrink-0 text-right text-muted sm:block">{(rated.get(p.puuid) ?? 1).toFixed(1)}</span>
                                <span className="hidden lg:block">{itemRow(p, 16)}</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
