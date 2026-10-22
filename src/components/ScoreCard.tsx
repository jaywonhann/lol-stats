// 인분 · 팀운 · 캐리력 패널 (서버 렌더, 자체 계산식)
import { Panel } from "@/components/ui";
import type { Axis, ScoreReport } from "@/lib/score";
import type { Lang } from "@/lib/i18n";

const T = {
  ko: {
    title: "인분 · 팀운 · 캐리력",
    own: "자체 계산식",
    inbun: "평균 인분",
    inbunSub: "1.0 = 한 판의 평균 선수",
    luck: "팀운",
    luckGood: "아군이 상대보다 잘한 편",
    luckBad: "아군이 상대보다 못한 편",
    luckMid: "아군·상대 비슷",
    carry: "캐리력",
    carrySub: "50 = 평균",
    carried: (n: number) => `지고도 1.2인분 이상 ${n}판`,
    weak: (n: number) => `이겼지만 0.8인분 미만 ${n}판`,
    recent: (n: number) => `최근 ${n}게임 · 최신이 왼쪽`,
    note: "딜량·킬관여·생존·시야·성장을 그 판 10명과 비교해 계산한 자체 지표예요 (공식 지표 아님). 서포터·정글은 역할에 맞게 가중치를 달리합니다.",
    axes: { dmg: "딜량", kp: "킬관여", survive: "생존", vision: "시야", growth: "성장" } as Record<Axis, string>,
    realTitle: "실제 수치 (Riot 기록 평균)",
    dmgShare: "팀 내 딜량 비중", goldShare: "팀 내 골드 비중", kp: "킬관여율", kda: "KDA",
    vis: "분당 시야점수", cs: "분당 CS",
    cs10: "10분 CS 차이 (상대 라이너 대비)", g15: "15분 골드 차이 (상대 라이너 대비)",
    tlNote: (n: number) => `라인전 수치는 타임라인이 있는 최근 ${n}게임 기준`,
    win: "승",
    loss: "패",
  },
  en: {
    title: "Contribution · Team luck · Carry",
    own: "own formula",
    inbun: "Avg contribution",
    inbunSub: "1.0 = the average player in a match",
    luck: "Team luck",
    luckGood: "Teammates outplayed the enemy",
    luckBad: "Teammates underperformed the enemy",
    luckMid: "Teams were about even",
    carry: "Carry power",
    carrySub: "50 = average",
    carried: (n: number) => `${n} losses at 1.2+`,
    weak: (n: number) => `${n} wins below 0.8`,
    recent: (n: number) => `Last ${n} games · newest on the left`,
    note: "Our own metric: damage, kill participation, survival, vision and growth compared with the other 9 players in each game (not an official stat). Support and jungle use different weights.",
    axes: { dmg: "Damage", kp: "Kill part.", survive: "Survival", vision: "Vision", growth: "Growth" } as Record<Axis, string>,
    realTitle: "Real numbers (average from Riot records)",
    dmgShare: "Team damage share", goldShare: "Team gold share", kp: "Kill participation", kda: "KDA",
    vis: "Vision score / min", cs: "CS / min",
    cs10: "CS diff @10 vs lane opponent", g15: "Gold diff @15 vs lane opponent",
    tlNote: (n: number) => `Laning numbers use the last ${n} games with timelines`,
    win: "W",
    loss: "L",
  },
};

export default function ScoreCard({ report, lang }: { report: ScoreReport; lang: Lang }) {
  const t = lang === "ko" ? T.ko : T.en;
  const luckText = report.luck >= 55 ? t.luckGood : report.luck <= 45 ? t.luckBad : t.luckMid;
  return (
    <Panel title={t.title}>
      <div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label={t.inbun} value={report.avgInbun.toFixed(2)} sub={t.inbunSub} />
            <Stat label={t.luck} value={String(report.luck)} sub={luckText} />
            <Stat label={t.carry} value={String(report.carry)} sub={t.carrySub} />
          </div>
          <p className="text-sm text-muted">
            {t.carried(report.carriedLosses)} · {t.weak(report.weakWins)}
          </p>
          <div>
            <div className="mb-1 text-xs text-muted">{t.recent(report.games.length)}</div>
            <div className="flex flex-wrap gap-1">
              {report.games.map((g, i) => (
                <span
                  key={g.id + i}
                  title={`${g.championName} · ${g.inbun.toFixed(2)}`}
                  className="rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    background: g.win ? "var(--chart-up)" : "var(--chart-down)",
                    color: "#fff",
                    opacity: 0.45 + Math.min(g.inbun, 1.6) / 1.6 / 2,
                  }}
                >
                  {g.inbun.toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold">{t.realTitle}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Real label={t.dmgShare} value={`${report.real.dmgShare.toFixed(1)}%`} />
          <Real label={t.goldShare} value={`${report.real.goldShare.toFixed(1)}%`} />
          <Real label={t.kp} value={`${report.real.kp.toFixed(0)}%`} />
          <Real label={t.kda} value={report.real.kda.toFixed(2)} />
          <Real label={t.vis} value={report.real.visionPerMin.toFixed(2)} />
          <Real label={t.cs} value={report.real.csPerMin.toFixed(1)} />
          {report.real.csDiff10 !== null && <Real label={t.cs10} value={signed(report.real.csDiff10, 1)} tone />}
          {report.real.goldDiff15 !== null && <Real label={t.g15} value={signed(report.real.goldDiff15, 0)} tone />}
        </div>
        {report.real.timelineGames > 0 && <p className="mt-2 text-xs text-muted">{t.tlNote(report.real.timelineGames)}</p>}
      </div>
      <p className="mt-4 text-xs text-muted">
        {t.own} · {t.note}
      </p>
    </Panel>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] leading-tight text-muted">{sub}</div>
    </div>
  );
}

const signed = (v: number, d: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;

function Real({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  const color = tone ? (value.startsWith("+") ? "var(--chart-up)" : "var(--chart-down)") : undefined;
  return (
    <div className="rounded-lg border border-line p-2">
      <div className="text-[11px] leading-tight text-muted">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
