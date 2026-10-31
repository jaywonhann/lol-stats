// 프로 프로필(이 사람이 프로면) + 나와 닮은 프로 선수: 같은 라인 프로들의 평균 스타일과 비교해요
import Link from "next/link";
import { Panel } from "@/components/ui";
import type { Lang } from "@/lib/i18n";
import { proStyles, similarPros, STYLE_KEYS, type Style } from "@/lib/pro-builds";

const T = {
  ko: {
    names: { cs: "CS", gold: "골드", dmg: "딜량", vision: "시야", kp: "킬관여", deaths: "데스 적게" } as Record<(typeof STYLE_KEYS)[number], string>,
    proTitle: "프로 프로필",
    kind: { pro: "프로 선수", streamer: "스트리머", challenger: "챌린저" } as Record<string, string>,
    cares: (a: string, b: string) => `가장 신경 쓰는 점: ${a}, ${b}`,
    caresNote: "같은 라인 프로들 평균보다 두드러지는 항목이에요.",
    games: (n: number) => `최근 ${n}판 기준`,
    simTitle: "나와 닮은 프로",
    simNote: (n: number, lane: string) => `내 최근 ${lane} 게임의 스타일을 ${lane} 프로 ${n}명과 비교했어요.`,
    sim: (p: number) => `${p}% 비슷`,
    needMore: "비교할 프로 데이터를 모으는 중이에요. 하루 이틀 뒤에 다시 와 주세요.",
    similarOf: "닮은 점",
  },
  en: {
    names: { cs: "CS", gold: "Gold", dmg: "Damage", vision: "Vision", kp: "Kill part.", deaths: "Few deaths" } as Record<(typeof STYLE_KEYS)[number], string>,
    proTitle: "Pro profile",
    kind: { pro: "Pro player", streamer: "Streamer", challenger: "Challenger" } as Record<string, string>,
    cares: (a: string, b: string) => `Focuses on: ${a}, ${b}`,
    caresNote: "Stands out versus the average pro in the same role.",
    games: (n: number) => `Based on ${n} recent games`,
    simTitle: "Pros who play like you",
    simNote: (n: number, lane: string) => `Your recent ${lane} games compared with ${n} ${lane} pros.`,
    sim: (p: number) => `${p}% alike`,
    needMore: "Still collecting pro data to compare. Check back in a day or two.",
    similarOf: "Alike in",
  },
};

export default async function ProMatch({
  me,
  lane,
  laneName,
  who,
  lang,
}: {
  me: Style;
  lane: string | null;
  laneName: string;
  who: string;
  lang: Lang;
}) {
  const t = T[lang];
  const pros = await proStyles();
  const self = pros.find((p) => p.who.toLowerCase() === who.toLowerCase());
  const res = similarPros(me, lane, pros, who);
  if (!res && !self) return null;
  const selfEmph = self && res ? res.emphasis(self.avg).slice(0, 2).map((e) => t.names[e.k]) : null;
  const myEmph = res ? res.emphasis(me) : [];
  return (
    <Panel title={self ? t.proTitle : t.simTitle}>
      {self && (
        <div className="mb-3 space-y-1 border-b border-line pb-3">
          <p className="text-lg font-bold">
            {self.label} <span className="text-sm font-normal text-muted">· {t.kind[self.kind]}</span>
          </p>
          {selfEmph && (
            <p className="text-sm">
              {t.cares(selfEmph[0], selfEmph[1])} <span className="text-xs text-muted">({t.games(self.n)})</span>
            </p>
          )}
          <p className="text-xs text-muted">{t.caresNote}</p>
        </div>
      )}
      {res ? (
        <>
          <p className="mb-2 text-xs text-muted">{t.simNote(res.poolSize, laneName)}</p>
          <ul className="space-y-2">
            {res.ranked.map(({ pro, sim }) => {
              const common = res
                .emphasis(pro.avg)
                .slice(0, 2)
                .map((e) => e.k)
                .filter((k) => myEmph.slice(0, 3).some((m) => m.k === k))
                .map((k) => t.names[k]);
              return (
                <li key={`${pro.s}-${pro.who}`} className="flex items-center gap-3 rounded-lg bg-panel-2 p-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/summoner?id=${encodeURIComponent(pro.who)}`} className="block truncate font-semibold hover:underline">
                      {pro.label}
                    </Link>
                    {common.length > 0 && (
                      <span className="text-xs text-muted">
                        {t.similarOf}: {common.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-accent">{t.sim(sim)}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">{t.needMore}</p>
      )}
    </Panel>
  );
}
