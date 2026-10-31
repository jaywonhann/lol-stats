import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES, laneLabel, parseLane } from "@/lib/lanes";
import { loadRealData } from "@/lib/real";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "챔피언 상성 비교" : "Champion matchup lookup",
    description: ko
      ? "두 챔피언을 고르면 같은 라인에서 붙었을 때의 실제 승률을 보여줘요."
      : "Pick two champions and see their real win rate against each other in the same lane.",
  };
}

type Props = { searchParams: Promise<{ a?: string; b?: string; lane?: string }> };

export default async function MatchupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await getLang();
  const ko = lang === "ko";
  const lane = parseLane(sp.lane);
  const [{ version, champions }, patches, server] = await Promise.all([getChampions(ddLocale(lang)), getPatches().catch(() => [] as string[]), getServer()]);
  const A = champions.find((c) => c.id === sp.a);
  const B = champions.find((c) => c.id === sp.b);

  // 가장 최근에 실제 데이터가 있는 패치 (에메랄드+ 전체)
  const real = loadRealData({ server, rank: "all" });
  const patch = [...patches].reverse().find((p) => real.has(p));
  const agg = A && B && patch ? real.get(patch)!.champs[`${A.key}:${lane}`] : undefined;
  const [g, w] = agg?.vs[B!.key] ?? [0, 0];
  const rate = g ? (w / g) * 100 : null;

  const select = "w-full rounded-lg bg-panel-2 px-3 py-3 text-base";
  const opts = champions.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "챔피언 상성 비교" : "Champion matchup lookup"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko ? "같은 라인에서 두 챔피언이 붙은 실제 게임의 승률이에요." : "Real win rate when two champions met in the same lane."}
        </p>
      </div>
      <Panel>
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted">{ko ? "내 챔피언" : "My champion"}</span>
            <select name="a" defaultValue={A?.id ?? ""} className={select} required>
              <option value="" disabled>
                {ko ? "선택" : "Select"}
              </option>
              {opts}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">{ko ? "상대 챔피언" : "Opponent"}</span>
            <select name="b" defaultValue={B?.id ?? ""} className={select} required>
              <option value="" disabled>
                {ko ? "선택" : "Select"}
              </option>
              {opts}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">{ko ? "라인" : "Lane"}</span>
            <select name="lane" defaultValue={lane} className={select}>
              {LANES.map((l) => (
                <option key={l.id} value={l.id}>
                  {laneLabel(l.id, lang)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="self-end rounded-lg bg-accent px-4 py-3 font-semibold text-bg">
            {ko ? "비교하기" : "Compare"}
          </button>
        </form>
      </Panel>
      {A && B && (
        <Panel>
          <div className="flex flex-wrap items-center justify-center gap-6 py-2">
            <Side c={A} version={version} />
            <span className="text-xl font-bold text-muted">VS</span>
            <Side c={B} version={version} />
          </div>
          {rate !== null && g >= 3 ? (
            <div className="mt-4 text-center">
              <p className="text-4xl font-bold tabular-nums" style={{ color: rate >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                {rate.toFixed(1)}%
              </p>
              <p className="mt-1 text-sm">
                {ko
                  ? `${laneLabel(lane, lang)}에서 ${A.name}가 ${B.name}를 상대로 이긴 비율 (${g}게임)`
                  : `${A.name} win rate against ${B.name} in ${laneLabel(lane, lang)} (${g} games)`}
              </p>
              {g < 10 && <p className="mt-2 text-xs text-muted">{ko ? "표본이 적어서 참고용이에요." : "Small sample, treat as a rough guide."}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
                <Link href={`/champions/${A.id}?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${A.name} 빌드 보기` : `${A.name} builds`}
                </Link>
                <Link href={`/champions/${B.id}?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${B.name} 빌드 보기` : `${B.name} builds`}
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm text-muted">
              {ko ? "이 조합은 아직 수집된 게임이 부족해요. 라인을 바꿔 보거나 다른 챔피언을 골라 보세요." : "Not enough collected games for this pairing yet. Try another lane or champion."}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

function Side({ c, version }: { c: { id: string; name: string; image: { full: string } }; version: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon src={img.champion(version, c.image.full)} alt={c.name} size={72} className="rounded-lg" />
      <span className="font-semibold">{c.name}</span>
    </div>
  );
}
