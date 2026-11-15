// 억까 판독기: 진 판이 내 탓인지 팀 탓인지 (서버 렌더, 자체 계산식)
import { Panel } from "@/components/ui";
import type { BlameReport } from "@/lib/score";
import type { Lang } from "@/lib/i18n";

const POS = {
  ko: { TOP: "탑", JUNGLE: "정글", MIDDLE: "미드", BOTTOM: "원딜", UTILITY: "서폿" } as Record<string, string>,
  en: { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support" } as Record<string, string>,
};

const T = {
  ko: {
    title: "억까 판독기: 내 탓일까 팀 탓일까",
    noLoss: (n: number) => `최근 ${n}판에서 진 판이 거의 없어요. 판독할 억까가 없네요.`,
    vUnlucky: "이건 억까 맞아요",
    vMine: "솔직히 내 지분이 커요",
    vEven: "반반이에요. 팀 탓만 하긴 어려워요",
    sub: (n: number, l: number) => `최근 ${n}판 중 진 ${l}판을 판별했어요`,
    unlucky: "억까", unluckySub: "팀 내 1~2등 하고도 짐",
    even: "반반", evenSub: "누구 탓이라 하기 애매",
    mine: "내 탓", mineSub: "팀 내 4~5등으로 짐",
    gap: (pos: string, c: number) => `진 판에서 제일 자주 터진 아군 라인은 ${pos}예요 (${c}판). "${pos} 차이" 외칠 만했어요.`,
    myGap: (c: number) => `반대로 내 라인이 팀에서 제일 크게 밀린 판도 ${c}판 있어요.`,
    wins: (c: number, b: number) => `이긴 판은 팀 내 1등 캐리 ${c}판, 버스 탄 판 ${b}판.`,
    streak: (s: number, n: number, p: string) =>
      `연패 구간 진짜일까? 가장 긴 연패는 ${s}연패예요. 승률 50%인 사람도 ${n}판 하면 ${s}연패 이상을 겪을 확률이 ${p}%라서, ${Number(p) >= 20 ? "흔한 일이에요. 매칭 탓보다는 운이에요." : "꽤 드문 일이에요. 진짜 고생했어요."}`,
    note: "딜량·킬관여·생존·시야·성장을 그 판 10명과 비교한 인분 점수로 판별한 자체 지표예요 (공식 지표 아님, 재미로 보세요).",
  },
  en: {
    title: "Was it me or my team?",
    noLoss: (n: number) => `Almost no losses in the last ${n} games. Nothing to judge.`,
    vUnlucky: "You really were unlucky",
    vMine: "Honestly, a lot of it was on you",
    vEven: "It's about even. Hard to blame only the team",
    sub: (n: number, l: number) => `Judged ${l} losses from the last ${n} games`,
    unlucky: "Team's fault", unluckySub: "Top 2 on your team and still lost",
    even: "Even", evenSub: "Hard to pin on anyone",
    mine: "On you", mineSub: "Bottom 2 on your team",
    gap: (pos: string, c: number) => `The teammate lane that collapsed most in your losses was ${pos} (${c} games). "${pos} diff" was fair.`,
    myGap: (c: number) => `But your own lane was the biggest gap on the team in ${c} games.`,
    wins: (c: number, b: number) => `In wins: ${c} games as the team's top performer, ${b} games carried by others.`,
    streak: (s: number, n: number, p: string) =>
      `Is losers queue real? Your longest loss streak was ${s}. A 50% win rate player has a ${p}% chance of a streak that long in ${n} games, so ${Number(p) >= 20 ? "it's common. More luck than matchmaking." : "that is fairly rare. Rough stretch."}`,
    note: "Our own metric based on contribution scores (damage, kill participation, survival, vision, growth vs the other 9 players). Not an official stat, just for fun.",
  },
};

export default function BlameCard({ report, lang }: { report: BlameReport; lang: Lang }) {
  const t = lang === "ko" ? T.ko : T.en;
  const pos = lang === "ko" ? POS.ko : POS.en;
  if (report.losses < 3)
    return (
      <Panel title={t.title}>
        <p className="text-sm text-muted">{t.noLoss(report.games)}</p>
      </Panel>
    );
  const verdict =
    report.unlucky > report.mine && report.unlucky * 2 >= report.losses - report.even
      ? { text: t.vUnlucky, color: "var(--chart-up)" }
      : report.mine > report.unlucky
        ? { text: t.vMine, color: "var(--chart-down)" }
        : { text: t.vEven, color: undefined };
  const bars = [
    { n: report.unlucky, label: t.unlucky, sub: t.unluckySub, bg: "var(--chart-up)" },
    { n: report.even, label: t.even, sub: t.evenSub, bg: "#8a8f98" },
    { n: report.mine, label: t.mine, sub: t.mineSub, bg: "var(--chart-down)" },
  ];
  return (
    <Panel title={t.title}>
      <div className="space-y-3">
        <div>
          <p className="text-2xl font-bold" style={{ color: verdict.color }}>{verdict.text}</p>
          <p className="text-xs text-muted">{t.sub(report.games, report.losses)}</p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-panel-2">
          {bars.map((b) => (b.n ? <div key={b.label} style={{ width: `${(b.n / report.losses) * 100}%`, background: b.bg }} /> : null))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {bars.map((b) => (
            <div key={b.label} className="rounded-lg border border-line p-2">
              <div className="text-xs text-muted">{b.label}</div>
              <div className="text-xl font-bold">{b.n}</div>
              <div className="text-xs leading-tight text-muted">{b.sub}</div>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-sm">
          {report.gapLane && report.gapLane.count >= 2 && <li>{t.gap(pos[report.gapLane.pos] ?? report.gapLane.pos, report.gapLane.count)}</li>}
          {report.myGap >= 2 && <li>{t.myGap(report.myGap)}</li>}
          <li>{t.wins(report.carried, report.bussed)}</li>
          {report.streakChance !== null && <li>{t.streak(report.streak, report.games, report.streakChance.toFixed(0))}</li>}
        </ul>
        <p className="text-xs text-muted">{t.note}</p>
      </div>
    </Panel>
  );
}
