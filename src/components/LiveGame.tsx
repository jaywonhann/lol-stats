// 소환사가 지금 게임 중이면 양 팀 10명과 챔피언·주문·경과 시간을 보여줘요 (op.gg 인게임 정보처럼)
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";
import { activeGame, soloEntry, type LeagueEntry } from "@/lib/riot";
import LiveGameRetry from "@/components/LiveGameRetry";

const TIER_COLOR: Record<string, string> = {
  IRON: "#7a6f69", BRONZE: "#a0623a", SILVER: "#9fb0bf", GOLD: "#e2b54a", PLATINUM: "#4fb8a8",
  EMERALD: "#2fbf71", DIAMOND: "#6fa8ff", MASTER: "#b660e0", GRANDMASTER: "#e05555", CHALLENGER: "#f2c94c",
};
const APEX = ["MASTER", "GRANDMASTER", "CHALLENGER"];
const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };

// "D2 54LP", "M 312LP" 처럼 짧게. 영문 첫 글자 + 단계 (GM은 두 글자)
function tierShort(e: LeagueEntry, ko: boolean) {
  const ab = e.tier === "GRANDMASTER" ? "GM" : e.tier[0];
  const step = APEX.includes(e.tier) ? "" : (ROMAN[e.rank] ?? "");
  const games = e.wins + e.losses;
  const wr = games ? Math.round((e.wins / games) * 100) : 0;
  return { label: `${ab}${step} ${e.leaguePoints}LP`, detail: games ? (ko ? `${games}판 ${wr}%` : `${games}G ${wr}%`) : "" };
}

const QUEUE: Record<number, [string, string]> = {
  420: ["솔로랭크", "Ranked Solo/Duo"],
  440: ["자유랭크", "Ranked Flex"],
  400: ["일반", "Normal Draft"],
  430: ["일반", "Normal Blind"],
  490: ["빠른 대전", "Quickplay"],
  450: ["칼바람 나락", "ARAM"],
  2400: ["증바람", "ARAM: Mayhem"],
  1700: ["아레나", "Arena"],
};

export default async function LiveGame({
  server,
  puuid,
  lang,
  tags,
  spellIcons,
}: {
  server: Server;
  puuid: string;
  lang: Lang;
  tags?: string[];
  spellIcons: Record<number, string>;
}) {
  const t0 = Date.now();
  const g = await activeGame(server, puuid, tags);
  const tg = Date.now() - t0;
  // Riot 요청 한도에 걸려 확인을 못 했으면, 화면을 비워 두지 않고 몇 초 뒤 다시 확인해요
  if (g === "retry") return <LiveGameRetry lang={lang} puuid={puuid} />;
  if (!g) return <span hidden data-live-timing={`spectator=${tg} none`} />;
  const ko = lang === "ko";
  const { version, champions } = await getChampions(ddLocale(lang)).catch(() => ({ version: "", champions: [] as never[] }));
  const byKey = new Map(champions.map((c) => [Number(c.key), c]));
  const secs = g.gameStartTime > 0 ? Math.max(0, Math.round((Date.now() - g.gameStartTime) / 1000)) : g.gameLength;
  const mins = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const queue = QUEUE[g.gameQueueConfigId]?.[ko ? 0 : 1] ?? (ko ? "게임" : "Game");
  // 각 플레이어 솔로랭크 티어 (10번 호출, 10분 캐시. 실패한 사람은 비워 둬요)
  const ranks = new Map<string, LeagueEntry | null>();
  await Promise.all(g.participants.filter((p) => p.puuid).map(async (p) => ranks.set(p.puuid, await soloEntry(server, p.puuid))));
  const tr = Date.now() - t0;
  const teams = [100, 200].map((id) => g.participants.filter((p) => p.teamId === id));

  return (
    <Panel>
      <span hidden data-live-timing={`spectator=${tg} ranks=${tr}`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lose/15 px-2.5 py-1 text-xs font-bold text-lose">
          <span className="h-2 w-2 animate-pulse rounded-full bg-lose" aria-hidden />
          {ko ? "지금 게임 중" : "In game now"}
        </span>
        <span className="text-sm font-semibold">{queue}</span>
        <span className="text-sm tabular-nums text-muted">{secs > 0 ? `${mins} ${ko ? "경과" : "elapsed"}` : ko ? "로딩 중" : "Loading"}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((team, i) => (
          <ul key={i} className={`space-y-1.5 rounded-lg p-2 ${i === 0 ? "bg-[rgba(80,140,255,0.08)]" : "bg-[rgba(255,90,90,0.08)]"}`}>
            <li className="px-1 text-xs font-semibold text-muted">{i === 0 ? (ko ? "블루팀" : "Blue team") : ko ? "레드팀" : "Red team"}</li>
            {team.map((p) => {
              const c = byKey.get(p.championId);
              const name = p.riotId ?? "?";
              const me = p.puuid === puuid;
              return (
                <li key={p.puuid || name} className="flex items-center gap-2">
                  {c && version ? <Icon src={img.champion(version, c.image.full)} alt={c.name} size={32} className="rounded-md" /> : <span className="h-8 w-8 rounded-md bg-panel-2" />}
                  <span className="flex flex-col gap-0.5">
                    {[p.spell1Id, p.spell2Id].map((s, j) =>
                      spellIcons[s] ? <Icon key={j} src={spellIcons[s]} alt="" size={15} className="rounded-sm" /> : <span key={j} className="h-[15px] w-[15px]" />,
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.riotId ? (
                      <Link href={`/summoner?id=${encodeURIComponent(name)}&s=${server}`} className={`block truncate text-sm hover:underline ${me ? "font-bold text-accent" : ""}`}>
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm">{name}</span>
                    )}
                    <span className="block truncate text-xs text-muted">{c?.name ?? ""}</span>
                  </span>
                  {(() => {
                    const e = ranks.get(p.puuid);
                    if (!e) return <span className="w-20 shrink-0 text-right text-xs text-muted">{ko ? "언랭" : "Unranked"}</span>;
                    const r = tierShort(e, ko);
                    return (
                      <span className="w-20 shrink-0 text-right leading-tight">
                        <span className="block text-xs font-bold tabular-nums" style={{ color: TIER_COLOR[e.tier] ?? "inherit" }}>{r.label}</span>
                        <span className="block text-[11px] tabular-nums text-muted">{r.detail}</span>
                      </span>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </Panel>
  );
}
