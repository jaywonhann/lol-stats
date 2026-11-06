import { Icon, Panel } from "@/components/ui";
import { img } from "@/lib/ddragon";
import type { Badge, BestGame, Rank } from "@/lib/achievements";
import { numLocale, timeAgo, type Lang } from "@/lib/i18n";

// 전적 검색 첫 화면의 "내 업적": 딴 배지, 최고의 한 판, 같이 게임한 사람들 사이 순위를 한 칸에 모아요.
export default function Achievements({
  badges, best, ranks, lang, version,
}: { badges: Badge[]; best: BestGame | null; ranks: Rank[]; lang: Lang; version: string | null }) {
  const ko = lang === "ko";
  const nl = numLocale(lang);
  const earned = badges.filter((b) => b.have >= b.need);
  // 아직 못 딴 배지는 거의 다 온 것부터 3개만 "다음 목표"로 보여 줘요
  const next = badges
    .filter((b) => b.have < b.need)
    .sort((a, b) => b.have / b.need - a.have / a.need)
    .slice(0, 3);
  const RANK_NAME: Record<Rank["id"], string> = ko
    ? { dmg: "분당 딜량", cs: "분당 CS", kp: "킬 관여율", kda: "KDA" }
    : { dmg: "Damage/min", cs: "CS/min", kp: "Kill participation", kda: "KDA" };
  const fmt = (r: Rank) => (r.id === "kp" ? `${Math.round(r.mine * 100)}%` : r.id === "dmg" ? Math.round(r.mine).toLocaleString(nl) : r.mine.toFixed(1));
  if (earned.length === 0 && next.length === 0 && !best && ranks.length === 0) return null;

  return (
    <Panel>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{ko ? "내 업적" : "My achievements"}</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {/* 딴 배지 */}
          <div>
            <p className="mb-2 text-xs text-muted">
              {ko ? `최근 경기에서 딴 배지 ${earned.length}개` : `${earned.length} badges earned in recent games`}
            </p>
            {earned.length === 0 ? (
              <p className="text-sm text-muted">{ko ? "아직 딴 배지가 없어요. 아래 목표부터 노려 보세요!" : "No badges yet. Try the goals below!"}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {earned.map((b) => (
                  <li key={b.id} title={b.how[lang]} className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
                    <span className="text-xl" aria-hidden>{b.icon}</span>
                    <span className="text-sm font-bold">{b.name[lang]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* 다음 목표 */}
          {next.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted">{ko ? "다음 목표" : "Next goals"}</p>
              <ul className="grid gap-2 sm:grid-cols-3">
                {next.map((b) => (
                  <li key={b.id} className="rounded-xl bg-panel-2 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="opacity-50 grayscale" aria-hidden>{b.icon}</span>
                      {b.name[lang]}
                    </p>
                    <p className="text-xs text-muted">{b.how[lang]}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(b.have / b.need) * 100}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted">{b.have}/{b.need}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* 같이 게임한 사람들 사이 순위 */}
          {ranks.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted">
                {ko ? `같이 게임한 플레이어 ${ranks[0].of}명 중 내 순위` : `How you rank among the ${ranks[0].of} players you met`}
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ranks.map((r) => (
                  <li key={r.id} className="rounded-xl bg-panel-2 px-3 py-2">
                    <p className="text-xs text-muted">{RANK_NAME[r.id]}</p>
                    <p className="text-lg font-bold" style={{ color: r.top <= 30 ? "var(--chart-up)" : undefined }}>
                      {ko ? `상위 ${r.top}%` : `Top ${r.top}%`}
                    </p>
                    <p className="text-xs tabular-nums text-muted">{ko ? `내 평균 ${fmt(r)}` : `Your avg ${fmt(r)}`}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* 최고의 한 판 */}
        {best && (
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <p className="text-xs font-semibold text-muted">{ko ? "최근 최고의 한 판" : "Best recent game"}</p>
            <div className="mt-2 flex items-center gap-3">
              {version && <Icon src={img.champion(version, `${best.championName}.png`)} alt={best.championName} size={56} className="rounded-lg" />}
              <div>
                <p className={`text-sm font-bold ${best.win ? "text-win" : "text-lose"}`}>{best.win ? (ko ? "승리" : "Victory") : ko ? "패배" : "Defeat"}</p>
                <p className="text-2xl font-extrabold tabular-nums">
                  {best.kills} / <span className="text-lose">{best.deaths}</span> / {best.assists}
                </p>
                <p className="text-xs text-muted">KDA {best.deaths === 0 ? "Perfect" : best.kda.toFixed(2)}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div><dt className="text-muted">{ko ? "딜량" : "Damage"}</dt><dd className="font-semibold tabular-nums">{best.dmg.toLocaleString(nl)}</dd></div>
              <div><dt className="text-muted">{ko ? "팀 딜 비중" : "Team dmg"}</dt><dd className="font-semibold tabular-nums">{Math.round(best.dmgShare * 100)}%</dd></div>
              <div><dt className="text-muted">{ko ? "분당 CS" : "CS/min"}</dt><dd className="font-semibold tabular-nums">{best.cs.toFixed(1)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">{timeAgo(new Date(best.at).toISOString(), lang)} · {Math.round(best.minutes)}{ko ? "분" : " min"}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
