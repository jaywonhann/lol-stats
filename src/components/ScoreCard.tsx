// 인분 · 팀운 · 캐리력 패널 (서버 렌더, 자체 계산식)
import { Panel } from "@/components/ui";
import { AXES, type Axis, type ScoreReport } from "@/lib/score";
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
    win: "W",
    loss: "L",
  },
};

function Radar({ values, labels }: { values: Record<Axis, number>; labels: Record<Axis, string> }) {
  const c = 110;
  const r = 78;
  const pt = (i: number, v: number) => {
    const a = (-90 + (360 / AXES.length) * i) * (Math.PI / 180);
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const ring = (v: number) => AXES.map((_, i) => pt(i, v).join(",")).join(" ");
  const poly = AXES.map((a, i) => pt(i, values[a]).join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[240px]" role="img" aria-label="radar">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--color-line)" strokeWidth={v === 50 ? 1.5 : 1} />
      ))}
      {AXES.map((_, i) => (
        <line key={i} x1={c} y1={c} x2={pt(i, 100)[0]} y2={pt(i, 100)[1]} stroke="var(--color-line)" />
      ))}
      <polygon points={poly} fill="var(--color-accent)" fillOpacity={0.25} stroke="var(--color-accent)" strokeWidth={2} />
      {AXES.map((a, i) => {
        const [x, y] = pt(i, 122);
        return (
          <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--color-text)">
            {labels[a]} {values[a]}
          </text>
        );
      })}
    </svg>
  );
}

export default function ScoreCard({ report, lang }: { report: ScoreReport; lang: Lang }) {
  const t = lang === "ko" ? T.ko : T.en;
  const luckText = report.luck >= 55 ? t.luckGood : report.luck <= 45 ? t.luckBad : t.luckMid;
  return (
    <Panel title={`${t.title}`}>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
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
        <Radar values={report.radar} labels={t.axes} />
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
