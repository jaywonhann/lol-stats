import type { Metadata } from "next";
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import SummonerSearch from "@/components/SummonerSearch";
import ShareButton from "@/components/ShareButton";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES, laneLabel, parseLane, type Lane } from "@/lib/lanes";
import { redirect } from "next/navigation";
import BreadcrumbLd from "@/components/BreadcrumbLd";
import { loadRealData } from "@/lib/real";
import { topMatchups } from "@/lib/matchups";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer, langAlternates } from "@/lib/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ a?: string; b?: string; lane?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const lang = await getLang();
  const ko = lang === "ko";
  if (sp.a && sp.b) {
    const { champions } = await getChampions(ddLocale(lang)).catch(() => ({ champions: [] as { id: string; key: string; name: string }[] }));
    const A = champions.find((c) => c.id === sp.a);
    const B = champions.find((c) => c.id === sp.b);
    if (A && B) {
      const ln = laneLabel(parseLane(sp.lane), lang);
      // 검색 결과 제목에 실제 숫자를 넣어요 (표본 20게임 이상일 때만)
      let num = "";
      let numDesc = "";
      try {
        const [patches, server] = await Promise.all([getPatches(), getServer()]);
        const real = loadRealData({ server, rank: "all" });
        const patch = [...patches].reverse().find((p) => real.has(p));
        const [g, w] = (patch && real.get(patch)!.champs[`${A.key}:${parseLane(sp.lane)}`]?.vs[B.key]) || [0, 0];
        if (g >= 20) {
          const r = ((w / g) * 100).toFixed(1);
          num = ` ${r}%`;
          numDesc = ko
            ? `${A.name} 승률 ${r}% (${g.toLocaleString("en-US")}게임). `
            : `${A.name} wins ${r}% of ${g.toLocaleString("en-US")} games. `;
        }
      } catch {}
      const card = `/api/matchup-card?a=${A.id}&b=${B.id}&lane=${parseLane(sp.lane)}`;
      return {
        // 상성 주소마다 따로 검색에 잡히게 (전엔 전부 /matchup 하나로 묶였어요)
        alternates: await langAlternates(`/matchup?a=${A.id}&b=${B.id}&lane=${parseLane(sp.lane)}`),
        openGraph: { images: card },
        twitter: { card: "summary_large_image", images: card },
        title: ko ? `${A.name} vs ${B.name} 상성 승률${num} (${ln})` : `${A.name} vs ${B.name} matchup win rate${num} (${ln})`,
        description: ko
          ? `${numDesc}${ln}에서 ${A.name}와 ${B.name}가 붙은 실제 랭크 게임 승률과, ${B.name} 상대로 잘 이기는 챔피언을 보여줘요.`
          : `${numDesc}Real ranked win rate when ${A.name} faced ${B.name} in ${ln}, plus the champions that beat ${B.name} most often.`,
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
  // 라인 없이 들어오면(/yasuo-vs-yone 같은 짧은 주소) 두 챔피언이 가장 많이 만난 라인으로 보내요
  if (A && B && !sp.lane && patch) {
    const champs = real.get(patch)!.champs;
    let best: Lane = lane;
    let most = -1;
    for (const l of LANES) {
      const n = champs[`${A.key}:${l.id}`]?.vs[B.key]?.[0] ?? 0;
      if (n > most) [most, best] = [n, l.id];
    }
    redirect(`/matchup?a=${A.id}&b=${B.id}&lane=${best}`);
  }
  const agg = A && B && patch ? real.get(patch)!.champs[`${A.key}:${lane}`] : undefined;
  const [g, w] = agg?.vs[B!.key] ?? [0, 0];
  const rate = g ? (w / g) * 100 : null;

  // 같은 라인에서 B를 가장 잘 이기는 챔피언, A가 가장 잘 이기는 챔피언 (실제 데이터, 표본 5게임 이상)
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const champsAgg = patch ? real.get(patch)!.champs : {};
  const beatsB: Ranked[] = [];
  if (B) {
    // B의 상대 기록을 뒤집어서 구해요 (X가 B를 이긴 판 = B가 X에게 진 판).
    // 전에는 그 라인의 모든 챔피언 기록을 하나씩 풀어 읽어서, 처음 여는 상성 페이지가 무료 서버에서 6초 넘게 걸렸어요 (2026-11-17).
    for (const [ck, [vg, bw]] of Object.entries(champsAgg[`${B.key}:${lane}`]?.vs ?? {})) {
      const c = byKey.get(ck);
      if (c && vg >= 5) beatsB.push({ c, games: vg, rate: ((vg - bw) / vg) * 100 });
    }
    beatsB.sort((x, y) => y.rate - x.rate || y.games - x.games);
  }
  // 아무것도 안 골랐을 때 보여줄 인기 상성 (같은 두 챔피언의 반대 방향은 한 번만)
  const popular: { a: Champ; b: Champ; lane: typeof lane; games: number; wins: number }[] = [];
  if (!(A && B)) {
    const seen = new Set<string>();
    for (const m of topMatchups()) {
      const a = byKey.get(m.a);
      const b = byKey.get(m.b);
      const pair = [m.a, m.b].sort().join(":") + m.lane;
      if (!a || !b || seen.has(pair)) continue;
      seen.add(pair);
      popular.push({ a, b, lane: m.lane, games: m.games, wins: m.wins });
      if (popular.length >= 12) break;
    }
  }
  const aBeats: Ranked[] = [];
  if (agg) {
    for (const [ok, [vg, vw]] of Object.entries(agg.vs)) {
      const c = byKey.get(ok);
      if (c && vg >= 5) aBeats.push({ c, games: vg, rate: (vw / vg) * 100 });
    }
    aBeats.sort((x, y) => y.rate - x.rate || y.games - x.games);
  }
  // A가 가장 자주 만나는 상대, A가 가장 힘들어하는 상대 (검색으로 들어온 사람이 다음에 볼 상성)
  const common = [...aBeats].filter((r) => r.c.id !== B?.id).sort((x, y) => y.games - x.games).slice(0, 6);
  const hardForA = [...aBeats].filter((r) => r.c.id !== B?.id && r.games >= 10).sort((x, y) => x.rate - y.rate || y.games - x.games).slice(0, 6);

  const select = "w-full rounded-lg bg-panel-2 px-3 py-3 text-base";
  const opts = champions.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));

  return (
    <div className="space-y-4">
      {A && B && (
        <BreadcrumbLd
          items={[
            { name: ko ? "상성" : "Matchups", path: "/matchup" },
            { name: `${A.name} vs ${B.name}`, path: `/matchup?a=${A.id}&b=${B.id}&lane=${lane}` },
          ]}
        />
      )}
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
              <div className="mt-3">
                <ShareButton
                  url={`/${A.id}-vs-${B.id}/${lane}`}
                  title={`${A.name} vs ${B.name}`}
                  label={ko ? "이 상성 친구한테 보내기" : "Send this matchup to a friend"}
                  copied={ko ? "승률과 링크를 복사했어요!" : "Win rate and link copied!"}
                  text={ko ? `${laneLabel(lane, lang)} ${A.name} vs ${B.name}: ${A.name} 승률 ${rate.toFixed(1)}% (${g}게임)` : `${A.name} vs ${B.name} (${laneLabel(lane, lang)}): ${A.name} wins ${rate.toFixed(1)}% of ${g} games`}
                  kind="matchup"
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
                <Link href={`/champions/${A.id}?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${A.name} 빌드 보기` : `${A.name} builds`}
                </Link>
                <Link href={`/champions/${B.id}?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${B.name} 빌드 보기` : `${B.name} builds`}
                </Link>
                <Link href={`/champions/${A.id}/counters?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${A.name} 카운터 전체` : `All ${A.name} counters`}
                </Link>
                <Link href={`/champions/${B.id}/counters?lane=${lane}`} className="text-accent hover:underline">
                  {ko ? `${B.name} 카운터 전체` : `All ${B.name} counters`}
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
      {!(A && B) && popular.length > 0 && (
        <Panel title={ko ? "많이 붙는 상성" : "Most-played matchups"}>
          <ul className="grid gap-1 sm:grid-cols-2">
            {popular.map(({ a, b, lane: l, games, wins }) => {
              const r = (wins / games) * 100;
              return (
                <li key={`${a.id}-${b.id}-${l}`}>
                  <Link href={`/matchup?a=${a.id}&b=${b.id}&lane=${l}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2">
                    <Icon src={img.champion(version, a.image.full)} alt={a.name} size={28} className="rounded" />
                    <span className="text-xs text-muted">vs</span>
                    <Icon src={img.champion(version, b.image.full)} alt={b.name} size={28} className="rounded" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {a.name} vs {b.name} <span className="text-xs text-muted">· {laneLabel(l, lang)}</span>
                    </span>
                    <span className="text-right text-xs tabular-nums">
                      <span className="font-semibold" style={{ color: r >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                        {r.toFixed(1)}%
                      </span>
                      <span className="block text-muted">{ko ? `${games}게임` : `${games} games`}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
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
      {A && B && (common.length > 0 || hardForA.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {common.length > 0 && (
            <Panel title={ko ? `${A.name}가 가장 자주 만나는 상대` : `${A.name}'s most common opponents`}>
              <RankList rows={common} version={version} href={(c) => `/matchup?a=${A.id}&b=${c.id}&lane=${lane}`} ko={ko} />
            </Panel>
          )}
          {hardForA.length > 0 && (
            <Panel title={ko ? `${A.name}가 가장 힘들어하는 상대` : `${A.name} struggles most against`}>
              <RankList rows={hardForA} version={version} href={(c) => `/matchup?a=${A.id}&b=${c.id}&lane=${lane}`} ko={ko} />
            </Panel>
          )}
        </div>
      )}
      {A && B && (
        // 검색으로 상성만 보고 나가는 사람이 자기 전적도 넣어 보게 (2026-11-17 유입 분석)
        <Panel title={ko ? "내 전적으로 확인해 보기" : "Check it against your own games"}>
          <p className="mb-3 text-sm text-muted">
            {ko
              ? "라이엇 ID를 넣으면 최근 20판에서 내가 어떤 상대에게 약했는지, 진 판이 억까였는지 내 탓이었는지 바로 보여줘요."
              : "Enter your Riot ID to see which opponents beat you in your last 20 games, and whether your losses were on you or your team."}
          </p>
          <SummonerSearch lang={lang} server={server} />
        </Panel>
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
