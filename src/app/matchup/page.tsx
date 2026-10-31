import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES, laneLabel, parseLane } from "@/lib/lanes";
import { loadRealData } from "@/lib/real";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ a?: string; b?: string; lane?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const lang = await getLang();
  const ko = lang === "ko";
  if (sp.a && sp.b) {
    const { champions } = await getChampions(ddLocale(lang)).catch(() => ({ champions: [] as { id: string; name: string }[] }));
    const A = champions.find((c) => c.id === sp.a);
    const B = champions.find((c) => c.id === sp.b);
    if (A && B) {
      const ln = laneLabel(parseLane(sp.lane), lang);
      return {
        title: ko ? `${A.name} vs ${B.name} 상성 승률 (${ln})` : `${A.name} vs ${B.name} matchup win rate (${ln})`,
        description: ko
          ? `${ln}에서 ${A.name}와 ${B.name}가 붙은 실제 랭크 게임 승률과, ${B.name} 상대로 잘 이기는 챔피언을 보여줘요.`
          : `Real ranked win rate when ${A.name} faced ${B.name} in ${ln}, plus the champions that beat ${B.name} most often.`,
      };
    }
  }
  return {
    title: ko ? "챔피언 상성 비교" : "Champion matchup lookup",
    description: ko
      ? "두 챔피언을 고르면 같은 라인에서 붙었을 때의 실제 승률을 보여줘요."
      : "Pick two champions and see their real win rate against each other in the same lane.",
  };
}

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

  // 같은 라인에서 B를 가장 잘 이기는 챔피언, A가 가장 잘 이기는 챔피언 (실제 데이터, 표본 5게임 이상)
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const champsAgg = patch ? real.get(patch)!.champs : {};
  const beatsB: Ranked[] = [];
  if (B) {
    for (const [k, v] of Object.entries(champsAgg)) {
      const [ck, cl] = k.split(":");
      if (cl !== lane || ck === B.key) continue;
      const [vg, vw] = v.vs[B.key] ?? [0, 0];
      const c = byKey.get(ck);
      if (c && vg >= 5) beatsB.push({ c, games: vg, rate: (vw / vg) * 100 });
    }
    beatsB.sort((x, y) => y.rate - x.rate || y.games - x.games);
  }
  const aBeats: Ranked[] = [];
  if (agg) {
    for (const [ok, [vg, vw]] of Object.entries(agg.vs)) {
      const c = byKey.get(ok);
      if (c && vg >= 5) aBeats.push({ c, games: vg, rate: (vw / vg) * 100 });
    }
    aBeats.sort((x, y) => y.rate - x.rate || y.games - x.games);
  }

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
      {A && B && (beatsB.length > 0 || aBeats.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {beatsB.length > 0 && (
            <Panel title={ko ? `${B.name} 상대로 잘 이기는 챔피언` : `Best picks against ${B.name}`}>
              <RankList rows={beatsB.slice(0, 6)} version={version} href={(c) => `/matchup?a=${c.id}&b=${B.id}&lane=${lane}`} ko={ko} />
            </Panel>
          )}
          {aBeats.length > 0 && (
            <Panel title={ko ? `${A.name}가 잘 이기는 상대` : `${A.name} wins most against`}>
              <RankList rows={aBeats.slice(0, 6)} version={version} href={(c) => `/matchup?a=${A.id}&b=${c.id}&lane=${lane}`} ko={ko} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

type Champ = { id: string; key: string; name: string; image: { full: string } };
type Ranked = { c: Champ; games: number; rate: number };

function RankList({ rows, version, href, ko }: { rows: Ranked[]; version: string; href: (c: Champ) => string; ko: boolean }) {
  return (
    <ul className="space-y-1">
      {rows.map(({ c, games, rate }) => (
        <li key={c.id}>
          <Link href={href(c)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2">
            <Icon src={img.champion(version, c.image.full)} alt={c.name} size={28} className="rounded" />
            <span className="flex-1 truncate text-sm">{c.name}</span>
            <span className="text-right text-xs tabular-nums">
              <span className="font-semibold" style={{ color: rate >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                {rate.toFixed(1)}%
              </span>
              <span className="block text-muted">{ko ? `${games}게임` : `${games} games`}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
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
