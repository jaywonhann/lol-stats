import Link from "next/link";
import ChampionSearch from "@/components/ChampionSearch";
import SummonerSearch from "@/components/SummonerSearch";
import { Icon, Panel, TierBadge, WinRate, pct } from "@/components/ui";
import { getChampions, getItems, getPatches, getRuneTrees, getSummonerSpells, img } from "@/lib/ddragon";
import BuildIcons from "@/components/BuildIcons";
import { quickBuild, realChamp } from "@/lib/real";
import { ddLocale, dict, type Lang } from "@/lib/i18n";
import { LANES, laneLabel, serverLabel } from "@/lib/lanes";
import { boards, movers } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";

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
    ? { title: `패치 ${patch} 어워드`, note: "실제 랭크 게임 기록으로 뽑은, 이번 패치의 재미있는 챔피언들이에요.", hidden: ["숨은 OP상", "아무도 안 하는데 제일 잘 이겨요"], people: ["국민 픽상", "어딜 가나 이 챔피언"], sad: ["억울한 인기상", "다들 하는데 자꾸 져요"], rocket: ["로켓 상승상", "최근 며칠 사이 가장 많이 뜬 챔피언"] }
    : { title: `Patch ${patch} awards`, note: "This patch's most interesting champions, picked from real ranked games.", hidden: ["Hidden OP", "Nobody plays it, and it wins the most"], people: ["People's pick", "It's in every game"], sad: ["Popular but sad", "Everyone picks it, everyone loses"], rocket: ["Rocket riser", "Climbed the most in the last few days"] };
  // 히어로 배경: 라인별 1위 중 승률이 가장 높은 챔피언
  const featured = picks
    .filter((p) => p.rows.length > 0)
    .map((p) => ({ lane: p.lane, s: p.rows[0] }))
    .sort((a, b) => b.s.winRate - a.s.winRate)[0];
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
  const quick = [
    { href: "/summoner", label: lang === "ko" ? "내 멘탈 지수 테스트" : "Test my mind meter", hot: true },
    { href: "/tier", label: t.nav.tier },
    { href: "/trends", label: t.nav.trends },
    { href: "/ranking", label: lang === "ko" ? "랭킹" : "Ranking" },
  ];

  return (
    <div className="space-y-10">
      <section className="fade-up relative -mx-4 overflow-hidden rounded-none border-line bg-panel px-4 py-12 sm:mx-0 sm:rounded-2xl sm:border sm:px-10 sm:py-14">
        {featured && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.splash(featured.s.champion.id)}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover object-[70%_20%] opacity-35 sm:w-3/4"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/30" />
          </>
        )}
        <div className="relative max-w-xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            live<span className="text-accent">lol</span>.stats
          </h1>
          <p className="mt-3 text-lg font-semibold sm:text-xl">{t.heroTagline}</p>
          <p className="mt-1 text-sm text-muted">
            {t.homeSubtitle(serverLabel(server, lang), patch)}
          </p>
          <div className="mt-6">
            <SummonerSearch lang={lang} server={server} large />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className={`rounded-full border px-3 py-1 text-xs transition-colors hover:border-accent hover:text-text ${
                  "hot" in q ? "border-accent text-accent" : "border-line bg-panel-2/70 text-muted"
                }`}
              >
                {q.label}
              </Link>
            ))}
          </div>
          {featured && (
            <Link
              href={`/champions/${featured.s.champion.id}?lane=${featured.lane}`}
              className="mt-6 inline-flex items-center gap-2 text-xs text-muted hover:text-accent"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {t.heroFeatured(featured.s.champion.name, laneLabel(featured.lane, lang))}
              <span aria-hidden>→</span>
            </Link>
          )}
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
                  className="lift flex flex-col items-center rounded-xl border border-line bg-panel p-4 text-center"
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
            title={lang === "ko" ? `지금 뜨는 빌드 · 패치 ${patch}` : `Hot builds right now · patch ${patch}`}
            note={lang === "ko" ? "라인별 상위 챔피언이 지금 가장 많이 가는 룬, 스펠, 코어템이에요." : "The runes, spells and core items the top champions in each lane are running."}
            href="/tier"
            link={t.viewAll}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hot.map(({ lane, s, qb }) => (
              <Link
                key={`${lane}-${s.champion.id}`}
                href={`/champions/${s.champion.id}?lane=${lane}`}
                className="lift block rounded-xl border border-line bg-panel p-3"
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
