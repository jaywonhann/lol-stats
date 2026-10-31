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
  },
};

const items = (p: Participant) => [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
const cs = (p: Participant) => p.totalMinionsKilled + p.neutralMinionsKilled;

export default function MatchList({
  matches,
  puuid,
  version,
  champions,
  lang,
}: {
  matches: Match[];
  puuid: string;
  version: string | null;
  champions: Champion[];
  lang: Lang;
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
          return (
            <li key={m.metadata.matchId}>
              <details className="group rounded-lg bg-panel">
                <summary
                  className={`flex cursor-pointer list-none flex-wrap [&::-webkit-details-marker]:hidden items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 ${win ? "bg-[color-mix(in_srgb,var(--chart-up)_12%,transparent)]" : "bg-[color-mix(in_srgb,var(--chart-down)_12%,transparent)]"}`}
                >
                  {champIcon(me, 40)}
                  <span className={`w-6 text-sm font-bold ${win ? "text-[var(--chart-up)]" : "text-[var(--chart-down)]"}`}>{win ? t.win : t.loss}</span>
                  <span className="text-sm font-semibold">
                    {me.kills}/{me.deaths}/{me.assists}
                  </span>
                  <span className="text-xs text-muted">
                    {t.cs} {cs(me)} · {t.min(minutes)}
                  </span>
                  <span className="text-xs font-bold text-accent">{t.inbun((rated.get(puuid) ?? 1).toFixed(2))}</span>
                  <span className="ml-auto flex items-center gap-3">
                    {itemRow(me, 22)}
                    <span className="hidden text-xs text-muted sm:inline">{t.ago(hours)}</span>
                  </span>
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
