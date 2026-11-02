// 소환사가 지금 게임 중이면 양 팀 10명과 챔피언·주문·경과 시간을 보여줘요 (op.gg 인게임 정보처럼)
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";
import { activeGame } from "@/lib/riot";

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
  const g = await activeGame(server, puuid, tags);
  if (!g) return null;
  const ko = lang === "ko";
  const { version, champions } = await getChampions(ddLocale(lang)).catch(() => ({ version: "", champions: [] as never[] }));
  const byKey = new Map(champions.map((c) => [Number(c.key), c]));
  const secs = g.gameStartTime > 0 ? Math.max(0, Math.round((Date.now() - g.gameStartTime) / 1000)) : g.gameLength;
  const mins = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const queue = QUEUE[g.gameQueueConfigId]?.[ko ? 0 : 1] ?? (ko ? "게임" : "Game");
  const teams = [100, 200].map((id) => g.participants.filter((p) => p.teamId === id));

  return (
    <Panel>
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
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </Panel>
  );
}
