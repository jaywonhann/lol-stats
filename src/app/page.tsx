import { patchName } from "@/lib/lanes";
import Link from "@/components/Link";
import ChampionSearch from "@/components/ChampionSearch";
import SummonerSearch from "@/components/SummonerSearch";
import { Icon, Panel, TierBadge, WinRate, pct } from "@/components/ui";
import { getChampions, getItems, getPatches, getRuneTrees, getSummonerSpells, img } from "@/lib/ddragon";
import BuildIcons from "@/components/BuildIcons";
import { loadActivity, quickBuild, realChamp } from "@/lib/real";
import { liveHistory } from "@/lib/live-history";
import { ddLocale, dict, type Lang } from "@/lib/i18n";
import { LANES, laneLabel, serverLabel } from "@/lib/lanes";
import { boards, movers } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";
import { topMatchups } from "@/lib/matchups";
import { loadAram, MIN_ARAM_GAMES } from "@/lib/aram";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lang = await getLang();
  const t = dict(lang);
  const other: Lang = lang === "ko" ? "en" : "ko";
  const [{ version, champions }, altChampions, patches, server] =
    await Promise.all([
      getChampions(ddLocale(lang)),
      // 검색은 다른 언어 이름으로도 되게 (실패하면 무시)
      getChampions(ddLocale(other))
        .then((r) => r.champions)
        .catch(() => []),
      getPatches(),
      getServer(),
    ]);
  const altName = new Map(altChampions.map((c) => [c.id, c.name]));
  const filter = { server, rank: "all" as const };
  // 새 패치에 아직 게임이 모자라면, 데이터가 있는 가장 최근 패치를 표시
  const { patches: shown, real: realData } = boards(champions, "mid", filter, patches);
  const patch = shown[shown.length - 1] ?? patches[patches.length - 1];
  const top5 = (lane: (typeof LANES)[number]["id"]) => {
    const b = boards(champions, lane, filter, patches).boards;
    return b[b.length - 1].slice(0, 5);
  };
  const moves = LANES.map((l) =>
    movers(champions, l.id, filter, patches, 3),
  );

  const picks = LANES.map((lane) => ({ lane: lane.id, rows: top5(lane.id) }));
  // 패치 어워드: 실제 데이터일 때만, 라인별 전체 표에서 재미있는 기록을 뽑아요
  const all = LANES.flatMap((l) => {
    const b = boards(champions, l.id, filter, patches);
    return b.source === "real" ? (b.boards[b.boards.length - 1] ?? []).map((s) => ({ lane: l.id, s })) : [];
  });
  const byPick = [...all].sort((a, b) => b.s.pickRate - a.s.pickRate);
  const popular = byPick.slice(0, Math.max(5, Math.ceil(byPick.length / 4)));
  const niche = byPick.slice(Math.ceil(byPick.length / 2));
  const awards = all.length >= 10
    ? [
        { key: "hidden", pick: [...niche].sort((a, b) => b.s.winRate - a.s.winRate)[0], value: (s: (typeof all)[number]["s"]) => `${t.winRate} ${s.winRate.toFixed(1)}%` },
        { key: "people", pick: byPick[0], value: (s: (typeof all)[number]["s"]) => `${t.pickRate} ${pct(s.pickRate)}` },
        { key: "sad", pick: [...popular].sort((a, b) => a.s.winRate - b.s.winRate)[0], value: (s: (typeof all)[number]["s"]) => `${t.winRate} ${s.winRate.toFixed(1)}%` },
        { key: "rocket", pick: moves
          .flatMap((m, i) => m.rising.map((r) => ({ lane: LANES[i].id, s: r.stat })))
          .sort((a, b) => b.s.scoreChange! - a.s.scoreChange!)[0], value: (s: (typeof all)[number]["s"]) => `${t.winRate} ${s.winRate.toFixed(1)}%` },
      ].filter((a, i, arr) => a.pick && arr.findIndex((b) => b.pick?.s.champion.id === a.pick!.s.champion.id) === i)
    : [];
  const AW = lang === "ko"
    ? { title: `패치 ${patchName(patch)} 어워드`, note: "실제 랭크 게임 기록으로 뽑은, 이번 패치의 재미있는 챔피언들이에요.", hidden: ["숨은 OP상", "아무도 안 하는데 제일 잘 이겨요"], people: ["국민 픽상", "어딜 가나 이 챔피언"], sad: ["억울한 인기상", "다들 하는데 자꾸 져요"], rocket: ["로켓 상승상", "최근 며칠 사이 가장 많이 뜬 챔피언"] }
    : { title: `Patch ${patchName(patch)} awards`, note: "This patch's most interesting champions, picked from real ranked games.", hidden: ["Hidden OP", "Nobody plays it, and it wins the most"], people: ["People's pick", "It's in every game"], sad: ["Popular but sad", "Everyone picks it, everyone loses"], rocket: ["Rocket riser", "Climbed the most in the last few days"] };
  // 첫 화면: 라인별 1위, 지금 게임 중인 인원(10분 기록의 마지막 값), 최근 24시간 분석 게임 수
  const laneTops = picks.filter((p) => p.rows.length > 0).map((p) => ({ lane: p.lane, s: p.rows[0] }));
  const liveNow = (await liveHistory(server).catch(() => [])).at(-1)?.estimate ?? null;
  const analyzed = loadActivity(server)?.total ?? 0;
  // "지금 뜨는 빌드": 라인별 상위 픽 중 메타 점수가 높은 챔피언과 그 챔피언의 대표 룬·스펠·코어템
  const [items, trees, spells] = await Promise.all([
    getItems(version, ddLocale(lang)),
    getRuneTrees(version, ddLocale(lang)),
    getSummonerSpells(version, ddLocale(lang)),
  ]).catch(() => [null, null, null] as const);
  const hotData = realData.get(patch);
  const hot = hotData && items && trees && spells
    ? picks
        .flatMap((p) => p.rows.slice(0, 2).map((s) => ({ lane: p.lane, s })))
        .sort((a, b) => b.s.score - a.s.score)
        .flatMap(({ lane, s }) => {
          const c = realChamp(hotData, s.champion, lane);
          return c ? [{ lane, s, qb: quickBuild(c, items, trees, spells) }] : [];
        })
        .slice(0, 8)
    : [];
  // 많이 붙는 상성 6개 (같은 두 챔피언의 반대 방향은 한 번만)
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const duels: { a: (typeof champions)[number]; b: (typeof champions)[number]; lane: (typeof LANES)[number]["id"]; games: number; wins: number }[] = [];
  const seenDuel = new Set<string>();
  for (const m of topMatchups()) {
    const a = byKey.get(m.a);
    const b = byKey.get(m.b);
    const pair = [m.a, m.b].sort().join(":") + m.lane;
    if (!a || !b || seenDuel.has(pair)) continue;
    seenDuel.add(pair);
    duels.push({ a, b, lane: m.lane, games: m.games, wins: m.wins });
    if (duels.length >= 6) break;
  }

  // 칼바람(증바람이 열려 있으면 증바람) 승률 TOP 6
  const aram = loadAram();
  const aramMode = aram.matches.mayhem ? "mayhem" : "aram";
  const aramTop = champions
    .map((c) => ({ c, a: aram.champs[`${aramMode}:${c.key}`] }))
    .filter((r) => r.a && r.a.games >= MIN_ARAM_GAMES)
    .map(({ c, a }) => ({ c, games: a!.games, wr: (a!.wins / a!.games) * 100, score: (a!.wins + 10) / (a!.games + 20) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 6);


  return (
    <div className="space-y-10">
      <section className="fade-up -mx-4 border-line bg-panel px-4 py-10 sm:mx-0 sm:rounded-2xl sm:border sm:px-8 sm:py-12">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            live<span className="text-accent">lol</span>.stats
          </h1>
          <p className="mt-2 text-sm text-muted">{t.heroTagline}</p>
        </div>
        <div className="mx-auto mt-6 max-w-2xl">
          <SummonerSearch lang={lang} server={server} large />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted">
          {liveNow != null && (
            <Link href="/tier" className="inline-flex items-center gap-1.5 hover:text-text">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#e8213a]" aria-hidden />
              <b className="text-base text-text tabular-nums">{liveNow.toLocaleString()}{lang === "ko" ? "명" : ""}</b>
              {lang === "ko" ? "지금 게임 중인 마스터+" : "Master+ players in game now"}
            </Link>
          )}
          {analyzed > 0 && (
            <span>
              <b className="text-base text-text tabular-nums">{analyzed.toLocaleString()}{lang === "ko" ? "판" : ""}</b>{" "}
              {lang === "ko" ? `최근 24시간 분석한 ${serverLabel(server, lang)} 게임` : `${serverLabel(server, lang)} games analyzed in 24h`}
            </span>
          )}
          <span>
            <b className="text-base text-text tabular-nums">{patchName(patch)}</b> {lang === "ko" ? "패치" : "patch"}
          </span>
        </div>
        {laneTops.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {laneTops.map(({ lane, s }) => (
              <Link key={lane} href={`/champions/${s.champion.id}?lane=${lane}`} className="lift rounded-xl bg-panel-2/60 p-3">
                <div className="text-xs font-semibold text-muted">{lang === "ko" ? `${laneLabel(lane, lang)} 1위` : `#1 ${laneLabel(lane, lang)}`}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Icon src={img.champion(version, s.champion.image.full)} alt={s.champion.name} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.champion.name}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: s.winRate >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                    {s.winRate.toFixed(1)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="fade-up" style={{ animationDelay: "30ms" }}>
        <SectionTitle
          title={lang === "ko" ? "게임 전에 쓰는 도구" : "Before your game"}
          note={lang === "ko" ? "챔피언 선택부터 게임 중까지 바로 쓸 수 있어요." : "From champ select to mid-game."}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(lang === "ko"
            ? [
                ["/multi", "멀티서치", "로비 채팅을 붙여 넣으면 우리 팀 5명 전적과 팀 맞춤 밴 추천"],
                ["/bans", "밴 추천", "이번 패치에 밴할 가치가 있는 챔피언과 밴 낭비 챔피언"],
                ["/predict", "승률 예측", "양 팀 챔피언으로 보는 예상 승률"],
                ["/tools", "게임 타이머", "상대 스펠 쿨타임과 오브젝트 재생성 시간"],
              ]
            : [
                ["/multi", "Multi-search", "Paste the lobby chat to see all five teammates and bans for your team"],
                ["/bans", "Who to ban", "Champions worth banning this patch, and bans you might be wasting"],
                ["/predict", "Win predictor", "Expected win rate from both teams' champions"],
                ["/tools", "Game timers", "Enemy summoner spell cooldowns and objective respawns"],
              ]
          ).map(([href, name, line]) => (
            <Link key={href} href={href} className="lift flex flex-col rounded-xl bg-panel p-4">
              <span className="text-sm font-bold">{name} <span className="text-accent">→</span></span>
              <span className="mt-1 text-xs leading-snug text-muted">{line}</span>
            </Link>
          ))}
        </div>
      </section>

      {awards.length > 0 && (
        <section className="fade-up" style={{ animationDelay: "60ms" }}>
          <SectionTitle title={AW.title} note={AW.note} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {awards.map(({ key, pick, value }) => {
              const [name, line] = AW[key as "hidden" | "people" | "sad" | "rocket"];
              return (
                <Link
                  key={key}
                  href={`/champions/${pick!.s.champion.id}?lane=${pick!.lane}`}
                  className="lift flex flex-col items-center rounded-xl bg-panel p-4 text-center"
                >
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">{name}</span>
                  <Icon src={img.champion(version, pick!.s.champion.image.full)} alt={pick!.s.champion.name} size={56} className="mt-3 rounded-full" />
                  <span className="mt-2 text-sm font-semibold">{pick!.s.champion.name}</span>
                  <span className="text-xs text-muted">{laneLabel(pick!.lane, lang)} · {value(pick!.s)}</span>
                  <span className="mt-2 text-xs leading-snug text-muted">{line}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {hot.length > 0 && (
        <section className="fade-up" style={{ animationDelay: "140ms" }}>
          <SectionTitle
            title={lang === "ko" ? `지금 뜨는 빌드 · 패치 ${patchName(patch)}` : `Hot builds right now · patch ${patchName(patch)}`}
            note={lang === "ko" ? "라인별 상위 챔피언이 지금 가장 많이 가는 룬, 스펠, 코어템이에요." : "The runes, spells and core items the top champions in each lane are running."}
            href="/tier"
            link={t.viewAll}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hot.map(({ lane, s, qb }) => (
              <Link
                key={`${lane}-${s.champion.id}`}
                href={`/champions/${s.champion.id}?lane=${lane}`}
                className="lift block rounded-xl bg-panel p-3"
              >
                <div className="flex items-center gap-2">
                  <Icon src={img.champion(version, s.champion.image.full)} alt={s.champion.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.champion.name}</div>
                    <div className="text-xs text-muted">{laneLabel(lane, lang)}</div>
                  </div>
                  <TierBadge tier={s.tier} lang={lang} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted">{t.winRate} <WinRate value={s.winRate} /></span>
                  <span className="text-muted">{t.pickRate} {pct(s.pickRate)}</span>
                  <span className="text-muted">{t.gamesN(s.games)}</span>
                </div>
                <div className="mt-2">
                  <BuildIcons qb={qb} version={version} size={24} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {duels.length > 0 && (
        <section>
          <SectionTitle
            title={lang === "ko" ? "많이 붙는 상성" : "Most-played matchups"}
            note={lang === "ko" ? "최근 랭크 게임에서 가장 자주 만난 라인 상대예요. 왼쪽 챔피언 기준 승률이에요." : "The lane opponents that met most often in recent ranked games. Win rate is for the left champion."}
            href="/matchup"
            link={t.viewAll}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {duels.map(({ a, b, lane, games, wins }) => {
              const r = (wins / games) * 100;
              return (
                <Link key={`${a.id}-${b.id}-${lane}`} href={`/matchup?a=${a.id}&b=${b.id}&lane=${lane}`} className="lift flex items-center gap-2 rounded-xl bg-panel p-3">
                  <Icon src={img.champion(version, a.image.full)} alt={a.name} size={36} />
                  <span className="text-xs font-bold text-muted">VS</span>
                  <Icon src={img.champion(version, b.image.full)} alt={b.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {a.name} vs {b.name}
                    </div>
                    <div className="text-xs text-muted">
                      {laneLabel(lane, lang)} · {t.gamesN(games)}
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: r >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                    {r.toFixed(1)}%
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {aramTop.length > 0 && (
        <section>
          <SectionTitle
            title={lang === "ko" ? (aramMode === "mayhem" ? "증바람 승률 TOP" : "칼바람 승률 TOP") : aramMode === "mayhem" ? "Top ARAM: Mayhem champions" : "Top ARAM champions"}
            note={lang === "ko" ? "한국·북미·유럽 실제 게임 기준이에요. 누르면 템트리가 나와요." : "From real games on KR, NA and EUW. Tap a champion for the build."}
            href={`/aram?mode=${aramMode}`}
            link={t.viewAll}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {aramTop.map(({ c, games, wr }) => (
              <Link key={c.id} href={`/aram/${c.id}?mode=${aramMode}`} className="lift flex items-center gap-2 rounded-xl bg-panel p-3">
                <Icon src={img.champion(version, c.image.full)} alt={c.name} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-xs tabular-nums">
                    <span className="font-bold" style={{ color: wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>{wr.toFixed(1)}%</span>
                    <span className="text-muted"> · {t.gamesN(games)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title={t.championSearch} href="/champions" link={lang === "ko" ? "전체 보기" : "View all"} />
        <Panel>
        <ChampionSearch
          lang={lang}
          champions={champions.map((c) => ({
            id: c.id,
            name: c.name,
            alt: altName.get(c.id),
            icon: img.champion(version, c.image.full),
          }))}
        />
        </Panel>
      </section>
    </div>
  );
}

function SectionTitle({ title, note, href, link }: { title: string; note?: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      {href && link && (
        <Link href={href} className="shrink-0 text-xs text-accent hover:underline">
          {link}
        </Link>
      )}
    </div>
  );
}
