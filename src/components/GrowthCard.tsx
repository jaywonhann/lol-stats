// 성장 요약: 성과 배지 + 6각형 능력치(애니메이션) + 짧은 개선 포인트
import { Panel } from "@/components/ui";
import { HEX, type Badge, type Growth, type HexKey } from "@/lib/growth";
import type { Lang } from "@/lib/i18n";

const T = {
  ko: {
    title: "내 성장 요약",
    hex: { dmg: "딜량", kp: "킬관여", survive: "생존", vision: "시야", growth: "성장", steady: "꾸준함" } as Record<HexKey, string>,
    badge: (b: Badge) =>
      ({
        streak: `🔥 ${b.value}연승 중`,
        best: `⭐ 최고 활약 ${b.champ} ${b.value}인분`,
        winning: `📈 최근 ${b.value}승, 이기는 흐름`,
        up: `🚀 최근 활약이 이전보다 ${b.value} 올랐어요`,
        carried: `💪 지고도 팀을 이끈 판 ${b.value}번`,
        solid: `🛡️ 평균 이상으로 해낸 판 ${b.value}`,
      })[b.id] ?? "",
    none: "아직 모인 게임이 적어요. 몇 판 더 하면 성과가 쌓여요.",
    strongest: (k: string) => `가장 강한 점: ${k}`,
    tipWith: (k: string, w: number, wo: number) => `${k}을(를) 챙긴 판은 승률 ${w}% (아닌 판 ${wo}%)`,
    tipPlain: (k: string) => `다음 목표: ${k} 조금만 더 챙겨 보기`,
    hint: "6각형이 넓을수록 균형 잡힌 플레이예요. 50이 평균이에요.",
  },
  en: {
    title: "My progress",
    hex: { dmg: "Damage", kp: "Kill part.", survive: "Survival", vision: "Vision", growth: "Growth", steady: "Consistency" } as Record<HexKey, string>,
    badge: (b: Badge) =>
      ({
        streak: `🔥 ${b.value}-game win streak`,
        best: `⭐ Best game: ${b.champ} at ${b.value}x`,
        winning: `📈 ${b.value} wins lately, on a roll`,
        up: `🚀 Recent form is ${b.value} above before`,
        carried: `💪 ${b.value} losses where you carried`,
        solid: `🛡️ ${b.value} games above average`,
      })[b.id] ?? "",
    none: "Not enough games yet. A few more and your highlights will show.",
    strongest: (k: string) => `Strongest: ${k}`,
    tipWith: (k: string, w: number, wo: number) => `Games where your ${k} was good: ${w}% win (otherwise ${wo}%)`,
    tipPlain: (k: string) => `Next goal: bring up your ${k}`,
    hint: "A wider hexagon means a more balanced game. 50 is average.",
  },
};

export default function GrowthCard({ g, lang }: { g: Growth; lang: Lang }) {
  const t = lang === "ko" ? T.ko : T.en;
  const c = 110, r = 78;
  const pt = (i: number, v: number) => {
    const a = (-90 + (360 / HEX.length) * i) * (Math.PI / 180);
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const ring = (v: number) => HEX.map((_, i) => pt(i, v).join(",")).join(" ");
  const poly = HEX.map((k, i) => pt(i, g.hex[k]).join(",")).join(" ");
  const weakLabel = t.hex[g.weakest];
  const tip = "plain" in g.tip ? t.tipPlain(weakLabel) : t.tipWith(weakLabel, g.tip.withWr, g.tip.withoutWr);
  return (
    <Panel title={t.title}>
      <div className="grid items-center gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {g.badges.length ? (
            <ul className="space-y-2">
              {g.badges.map((b) => (
                <li key={b.id} className="fade-up rounded-lg bg-panel-2 px-3 py-2 text-sm font-medium">
                  {t.badge(b)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.none}</p>
          )}
          <p className="text-sm text-muted">{t.strongest(t.hex[g.strongest])}</p>
          <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold">🎯 {tip}</p>
        </div>
        <div>
          <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[260px]" role="img" aria-label="hexagon">
            {[25, 50, 75, 100].map((v) => (
              <polygon key={v} points={ring(v)} fill="none" stroke="var(--color-line)" strokeWidth={v === 50 ? 1.5 : 1} />
            ))}
            {HEX.map((_, i) => (
              <line key={i} x1={c} y1={c} x2={pt(i, 100)[0]} y2={pt(i, 100)[1]} stroke="var(--color-line)" />
            ))}
            <g className="hex-grow">
              <polygon points={poly} fill="var(--color-accent)" fillOpacity={0.28} stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
              {HEX.map((k, i) => (
                <circle key={k} cx={pt(i, g.hex[k])[0]} cy={pt(i, g.hex[k])[1]} r={k === g.weakest ? 4.5 : 3} fill={k === g.weakest ? "var(--chart-down)" : "var(--color-accent)"} />
              ))}
            </g>
            {HEX.map((k, i) => {
              const [x, y] = pt(i, 123);
              return (
                <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight={k === g.weakest ? 700 : 400} fill={k === g.weakest ? "var(--chart-down)" : "var(--color-text)"}>
                  {t.hex[k]} {g.hex[k]}
                </text>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-xs text-muted">{t.hint}</p>
        </div>
      </div>
    </Panel>
  );
}
