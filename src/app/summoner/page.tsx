import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { DivergingBars } from "@/components/charts";
import TierEmblem from "@/components/TierEmblem";
import UpdateButton from "@/components/UpdateButton";
import FormChart from "@/components/FormChart";
import ScoreCard from "@/components/ScoreCard";
import GrowthCard from "@/components/GrowthCard";
import ProMatch from "@/components/ProMatch";
import MatchList from "@/components/MatchList";
import { growth } from "@/lib/growth";
import { scoreReport } from "@/lib/score";
import SummonerSearch from "@/components/SummonerSearch";
import { getChampions, getPatches, getVersion, img, type Champion } from "@/lib/ddragon";
import { ddLocale, dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import { boards } from "@/lib/stats";
import { fetchedAt } from "@/lib/summoner-cache";
import { laneLabel, serverLabel, type Lane, type Server } from "@/lib/lanes";
import { getLang, getServer } from "@/lib/server";
import {
  lookupSummoner,
  parseRiotId,
  RiotError,
  summonerTag,
  type LeagueEntry,
  type Lookup,
  type LookupError,
} from "@/lib/riot";
import {
  champSummaries,
  form,
  laneDiffs,
  roles,
  siteAverages,
  strengthsWeaknesses,
  toGames,
  type ChampSummary,
  type Game,
  type Metric,
} from "@/lib/summoner";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

const rawId = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v ?? "").slice(0, 60);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, lang] = await Promise.all([searchParams, getLang()]);
  const t = dict(lang).summoner;
  const id = rawId(sp.id).trim();
  return { title: id ? t.metaTitle(id) : t.title };
}

export default async function SummonerPage({ searchParams }: Props) {
  const [sp, lang, server] = await Promise.all([searchParams, getLang(), getServer()]);
  const t = dict(lang).summoner;
  const raw = rawId(sp.id);
  const parsed = raw ? parseRiotId(raw, server) : null;

  const header = (
    <section className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>
      <SummonerSearch lang={lang} server={server} defaultValue={raw} />
    </section>
  );
  if (!parsed) return <div className="space-y-6">{header}</div>;

  const riotId = `${parsed.gameName}#${parsed.tagLine}`;
  let result: Lookup | null = null;
  let error: LookupError | null = null;
  try {
    result = await lookupSummoner(server, parsed.gameName, parsed.tagLine);
  } catch (e) {
    error = e instanceof RiotError ? e.kind : "error";
  }

  const tagNote = parsed.defaultedTag && (
    <p className="text-xs text-muted">{t.defaultedTag(parsed.tagLine)}</p>
  );

  if (!result) {
    const message =
      error === "not-found"
        ? t.notFound(riotId, serverLabel(server, lang))
        : error === "rate-limited"
          ? t.rateLimited
          : error === "unavailable"
            ? t.unavailable
            : t.error;
    return (
      <div className="space-y-6">
        {header}
        <Panel>
          <p role="alert" className="text-sm">
            {message}
          </p>
          {error === "not-found" && <div className="mt-2">{tagNote}</div>}
        </Panel>
      </div>
    );
  }

  const [version, champions, patches, at] = await Promise.all([
    getVersion().catch(() => null),
    getChampions(ddLocale(lang))
      .then((r) => r.champions)
      .catch(() => [] as Champion[]),
    getPatches().catch(() => [] as string[]),
    fetchedAt(summonerTag(server, parsed.gameName, parsed.tagLine)),
  ]);
  const update = (
    <UpdateButton
      id={riotId}
      server={server}
      fetchedAt={at}
      labels={{
        update: t.update,
        updating: t.updating,
        updatedAgo: t.updatedAgo(timeAgo(new Date(at).toISOString(), lang, { minutes: true })),
        failed: t.updateFailed,
        wait: t.updateWait(-1),
      }}
    />
  );

  return (
    <div className="space-y-6">
      {header}
      <Analysis
        result={result}
        lang={lang}
        server={server}
        version={version}
        champions={champions}
        patches={patches}
        tagNote={tagNote}
        update={update}
      />
    </div>
  );
}

const fix = (v: number, d = 1) => v.toFixed(d);

function Analysis({
  result,
  lang,
  server,
  version,
  champions,
  patches,
  tagNote,
  update,
}: {
  result: Lookup;
  lang: Lang;
  server: Server;
  version: string | null;
  champions: Champion[];
  patches: string[];
  update: React.ReactNode;
  tagNote: React.ReactNode;
}) {
  const t = dict(lang).summoner;
  const nl = numLocale(lang);
  const { account, profile, solo } = result;
  const games = toGames(result.matches, account.puuid);

  const profileHeader = (
    <Panel>
      <div className="flex flex-wrap items-center gap-4">
        {version && profile ? (
          <Icon src={img.profileIcon(version, profile.profileIconId)} alt="" size={64} className="rounded-xl bg-panel-2" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-xl bg-panel-2" />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-bold">
            {account.gameName} <span className="font-normal text-muted">#{account.tagLine}</span>
          </p>
          <p className="text-sm text-muted">
            {serverLabel(server, lang)}
            {profile && ` · ${t.level(profile.summonerLevel.toLocaleString(nl))}`}
          </p>
        </div>
        <RankBox solo={solo} lang={lang} />
      </div>
      <div className="mt-3 flex justify-end border-t border-line pt-3">{update}</div>
    </Panel>
  );

  if (!games.length)
    return (
      <>
        {profileHeader}
        {tagNote}
        <Panel>
          <p className="text-sm">{t.noGames}</p>
        </Panel>
      </>
    );

  const avg = siteAverages(server);
  const champs = champSummaries(games, champions, avg);
  const roleList = roles(games);
  const lanes = laneDiffs(games);
  const sw = strengthsWeaknesses(lanes.diffs);
  const f = form(games);
  const score = scoreReport(result.matches, account.puuid, result.timelines);
  const mainLane = roleList[0]?.lane ?? null;
  const laneName = (l: Lane) => laneLabel(l, lang);
  const total = games.length;

  // 요약 문장 (규칙 기반)
  const record = (c: ChampSummary) => t.champRecord(c.championName, c.wins, c.games - c.wins, fix(c.winRate, 0));
  const enough = champs.filter((c) => c.games >= 3);
  const best = [...enough].filter((c) => c.winRate >= 50).sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, 2);
  const avoid = enough.filter((c) => c.winRate < 45).sort((a, b) => a.winRate - b.winRate).slice(0, 2);
  const s0 = sw.strengths[0];
  const w0 = sw.weaknesses[0];
  const summary = [
    mainLane && t.sumRole(laneName(mainLane), roleList[0].games, total),
    best.length ? t.sumBest(best.map(record).join(", ")) : !enough.length ? t.sumBestNone : null,
    avoid.length ? t.sumAvoid(avoid.map(record).join(", ")) : null,
    [s0 && t.sumStrength(t.metricNames[s0.metric], fix(s0.value, 0)), w0 && t.sumWeakness(t.metricNames[w0.metric], fix(-w0.value, 0))]
      .filter(Boolean)
      .join(" ") || null,
    t.sumForm(f.wins, f.losses, fix(f.winRate, 0), f.streak ? t.sumStreak(f.streak.win, f.streak.count) : ""),
  ].filter((s): s is string => !!s);

  // 활용 팁 (사이트 안으로 연결)
  const topChamp = champs.find((c) => c.champion && c.lane);
  const laneQ = mainLane ? `?lane=${mainLane}` : "";
  const mainLaneName = mainLane ? laneName(mainLane) : "";
  const tips: { text: string; href?: string; link?: string }[] = [];
  if (topChamp?.champion && topChamp.lane)
    tips.push({
      text: t.tipBuild(topChamp.championName, laneName(topChamp.lane)),
      href: `/champions/${topChamp.champion.id}?lane=${topChamp.lane}`,
      link: t.tipBuildLink(topChamp.championName),
    });
  if (mainLane) {
    tips.push({ text: t.tipMeta(mainLaneName), href: `/meta${laneQ}`, link: t.tipMetaLink });
    tips.push({ text: t.tipTier(mainLaneName), href: `/tier${laneQ}`, link: t.tipTierLink(mainLaneName) });
  }
  tips.push({ text: w0 ? t.tipPractice[w0.metric] : t.tipKeepGoing });

  const champIcon = (c: { championName: string; champion: Champion | null }, size: number) =>
    version ? (
      <Icon src={img.champion(version, c.champion?.image.full ?? `${c.championName}.png`)} alt={c.championName} size={size} />
    ) : (
      <span className="shrink-0 rounded bg-panel-2" style={{ width: size, height: size }} />
    );
  const nameOf = (g: { championId: number; championName: string }) =>
    champions.find((c) => c.key === String(g.championId))?.name ?? g.championName;

  // 지금 흐름 · 이번 게임 추천 (규칙 기반)
  const last5 = games.slice(0, 5);
  const w5 = last5.filter((g) => g.win).length;
  const l5 = last5.length - w5;
  const flow =
    f.streak && f.streak.count >= 3
      ? f.streak.win
        ? t.flowWinStreak(f.streak.count)
        : t.flowLossStreak(f.streak.count)
      : last5.length >= 3 && (w5 / last5.length) * 100 >= f.winRate + 10
        ? t.flowRising(w5, l5)
        : last5.length >= 3 && (w5 / last5.length) * 100 <= f.winRate - 10
          ? t.flowFalling(w5, l5)
          : t.flowSteady(w5, l5);
  const flowTone = f.streak && f.streak.count >= 3 ? (f.streak.win ? "up" : "down") : w5 > l5 ? "up" : w5 < l5 ? "down" : null;
  const lastChamp = champs.find((c) => c.championId === games[0].championId);
  const personal = champs
    .filter((c) => c.games >= 2 && c.winRate >= 55 && (!mainLane || c.lane === mainLane))
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
  const metaTop = mainLane
    ? boards(champions, mainLane, { server, rank: "all" }, patches).boards.at(-1)?.[0]
    : undefined;
  let pick: { text: string; champ: Champion | null; name: string; lane: Lane | null } | null = null;
  if (f.streak?.win && f.streak.count >= 2 && lastChamp) {
    const lane = games[0].lane ?? lastChamp.lane;
    pick = { text: t.pickKeep(lastChamp.championName, lane ? laneName(lane) : ""), champ: lastChamp.champion, name: lastChamp.championName, lane };
  } else if (personal) {
    pick = { text: t.pickBest(personal.championName, personal.lane ? laneName(personal.lane) : "", fix(personal.winRate, 0)), champ: personal.champion, name: personal.championName, lane: personal.lane };
  } else if (metaTop && mainLane) {
    pick = { text: t.pickMeta(metaTop.champion.name, laneName(mainLane), fix(metaTop.winRate, 1)), champ: metaTop.champion, name: metaTop.champion.name, lane: mainLane };
  }
  const rest = champs
    .filter((c) => c.games >= 3 && c.winRate <= 34 && String(c.championId) !== pick?.champ?.key)
    .sort((a, b) => a.winRate - b.winRate)[0];
  // "연습 포인트: 시야. 귀환할 때마다…" → "귀환할 때마다…"
  const goalRaw = (w0 ? t.tipPractice[w0.metric] : t.tipKeepGoing).replace(/^[^:：]+[:：]\s*/, "");
  const goalBody = goalRaw.replace(/^[^.]+\.\s*/, "");
  const goal = goalBody || goalRaw.charAt(0).toUpperCase() + goalRaw.slice(1);
  const nowPanel = (
    <section className="rounded-xl border border-accent/40 bg-panel p-5 shadow-[0_0_40px_-16px_var(--color-accent)] md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{t.nowTitle}</h2>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">{t.flowLabel}</p>
          <p
            className="mt-1 text-xl font-bold leading-snug sm:text-2xl"
            style={flowTone ? { color: flowTone === "up" ? "var(--chart-up)" : "var(--chart-down)" } : undefined}
          >
            {flowTone === "up" ? "▲ " : flowTone === "down" ? "▼ " : ""}
            {flow}
          </p>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {[...last5].reverse().map((g) => (
              <span
                key={g.id}
                className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ background: g.win ? "var(--chart-up)" : "var(--chart-down)" }}
              >
                {g.win ? t.winShort : t.lossShort}
              </span>
            ))}
          </div>
        </div>
        {pick && (
          <div>
            <p className="text-xs font-medium text-muted">{t.pickLabel}</p>
            <div className="mt-1 flex items-start gap-3">
              {pick.champ && version && (
                <Icon src={img.champion(version, pick.champ.image.full)} alt={pick.name} size={56} className="rounded-lg" />
              )}
              <div className="min-w-0">
                <p className="text-xl font-bold leading-snug sm:text-2xl">{pick.text}</p>
                {pick.champ && (
                  <Link
                    href={`/champions/${pick.champ.id}${pick.lane ? `?lane=${pick.lane}` : ""}`}
                    className="mt-1 inline-block text-sm font-semibold text-accent hover:underline"
                  >
                    {t.pickBuild} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">{t.goalLabel}</p>
          <p className="mt-1 text-lg font-semibold leading-snug">{goal}</p>
        </div>
        {rest && (
          <div>
            <p className="text-xs font-medium text-muted">{t.avoidLabel}</p>
            <p className="mt-1 text-lg font-semibold leading-snug" style={{ color: "var(--chart-down)" }}>
              {t.avoidText(rest.championName, rest.wins, rest.games - rest.wins)}
            </p>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      {profileHeader}
      {nowPanel}
      <div className="space-y-1 text-xs text-muted">
        <p>{t.analyzed(total, result.matchIds)}</p>
        {tagNote}
      </div>

      {score && <GrowthCard g={growth(score)} lang={lang} />}

      {mainLane && (
        <ProMatch
          me={avgStyle(games.filter((g) => g.lane === mainLane))}
          lane={mainLane}
          laneName={laneName(mainLane)}
          who={`${account.gameName}#${account.tagLine}`}
          lang={lang}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t.summary}>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-accent">
            {summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Panel>
        <Panel title={t.howTo}>
          <ol className="space-y-3 text-sm leading-relaxed">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-2 text-xs font-semibold text-accent">{i + 1}</span>
                <span className="min-w-0">
                  {tip.text}
                  {tip.href && (
                    <>
                      {" "}
                      <Link href={tip.href} className="whitespace-nowrap text-accent hover:underline">
                        {tip.link} →
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <MatchList matches={result.matches} puuid={account.puuid} version={version} champions={champions} lang={lang} />

      <Panel title={t.form}>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <Stat label={t.recentWinRate} value={`${fix(f.winRate, 0)}%`} sub={t.record(String(f.wins), String(f.losses))} />
          <Stat
            label={t.currentStreak}
            value={f.streak ? t.streak(f.streak.win, f.streak.count) : "-"}
            tone={f.streak ? (f.streak.win ? "up" : "down") : undefined}
          />
          <Stat
            label={t.net}
            value={`${f.wins - f.losses >= 0 ? "▲+" : "▼−"}${Math.abs(f.wins - f.losses)}`}
            tone={f.wins - f.losses >= 0 ? "up" : "down"}
          />
        </div>
        <FormChart
          games={f.chrono.map((g) => ({
            win: g.win,
            title: t.gameTitle(nameOf(g), g.win, `${g.kills}/${g.deaths}/${g.assists}`),
          }))}
          winLabel={t.winShort}
          lossLabel={t.lossShort}
          oldest={t.oldest}
          latest={t.latest}
          aria={t.formAria(f.wins, f.losses)}
        />
        <p className="mt-3 text-xs text-muted">{t.formNote}</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t.mostPlayed} className="lg:col-span-2">
          <div className="mb-1 hidden grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.5rem_3.5rem_3.5rem_6rem] gap-x-3 text-[11px] text-muted sm:grid">
            <span />
            <span />
            <span className="text-right">{t.games}</span>
            <span className="text-right">{dict(lang).winRate}</span>
            <span className="text-right">{t.kda}</span>
            <span className="text-right">{t.csMin}</span>
            <span className="text-right">{t.siteAvg}</span>
          </div>
          <ul className="divide-y divide-line">
            {champs.slice(0, 5).map((c) => (
              <li
                key={c.championId}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.5rem_3.5rem_3.5rem_6rem]"
              >
                {champIcon(c, 32)}
                <div className="min-w-0">
                  {c.champion ? (
                    <Link href={`/champions/${c.champion.id}${c.lane ? `?lane=${c.lane}` : ""}`} className="block truncate text-sm font-medium hover:text-accent">
                      {c.championName}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium">{c.championName}</span>
                  )}
                  <span className="text-xs text-muted">{c.lane ? laneName(c.lane) : "-"}</span>
                </div>
                <div className="col-span-2 grid grid-cols-5 gap-2 text-sm sm:contents">
                  <Cell label={t.games} value={String(c.games)} />
                  <Cell
                    label={dict(lang).winRate}
                    value={`${fix(c.winRate, 0)}%`}
                    className={c.winRate >= 55 ? "text-win" : c.winRate < 45 ? "text-lose" : ""}
                  />
                  <Cell label={t.kda} value={fix(c.kda, 2)} />
                  <Cell label={t.csMin} value={fix(c.csPerMin)} />
                  <div className="text-right leading-tight">
                    <span className="block text-[10px] text-muted sm:hidden">{t.siteAvg}</span>
                    {c.siteWinRate === null ? (
                      <span className="text-muted">-</span>
                    ) : (
                      <>
                        <span className="block whitespace-nowrap text-xs text-muted">{t.siteAvgVal(fix(c.siteWinRate))}</span>
                        <Delta value={c.winRate - c.siteWinRate} />
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {avg.patch ? t.siteAvgNote(serverLabel(server, lang), avg.patch) : t.noSiteAvg}
          </p>
        </Panel>

        <Panel title={t.roles}>
          <ul className="space-y-3">
            {roleList.map((r) => (
              <li key={r.lane}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{laneName(r.lane)}</span>
                  <span className="text-muted">
                    {t.gameCount(r.games)} · {fix((r.games / total) * 100, 0)}%
                  </span>
                </div>
                <div className="h-2 rounded bg-panel-2">
                  <div className="h-2 rounded bg-accent" style={{ width: `${(r.games / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {score && <ScoreCard report={score} lang={lang} />}

      <Panel title={t.laneVs}>
        {lanes.games === 0 ? (
          <p className="text-sm text-muted">{t.noLaneVs}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <DivergingBars
              title={t.laneVsCaption(lanes.games)}
              bars={lanes.diffs.map((d) => ({
                label: t.metrics[d.metric],
                value: d.value,
                detail: `${d.value >= 0 ? "+" : "−"}${fix(Math.abs(d.value))}%`,
              }))}
              wide
              format={(v) => `${v >= 0 ? "▲+" : "▼−"}${fix(Math.abs(v))}%`}
            />
            <div className="space-y-4">
              <SwList title={t.strengths} empty={t.noStrength} items={sw.strengths} up explain={t.explainUp} label={t.metrics} />
              <SwList title={t.weaknesses} empty={t.noWeakness} items={sw.weaknesses} explain={t.explainDown} label={t.metrics} />
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

const TIER_HEX: Record<string, string> = {
  IRON: "#a39a94",
  BRONZE: "#c8834f",
  SILVER: "#b4c4d2",
  GOLD: "#f0c75e",
  PLATINUM: "#5fd0bd",
  EMERALD: "#3fd486",
  DIAMOND: "#86b6ff",
  MASTER: "#c77dea",
  GRANDMASTER: "#f06b6b",
  CHALLENGER: "#f7d774",
};

function RankBox({ solo, lang }: { solo: LeagueEntry | null; lang: Lang }) {
  const t = dict(lang).summoner;
  const nl = numLocale(lang);
  if (!solo)
    return (
      <div className="flex w-full items-center gap-4 rounded-xl border border-line bg-panel-2 px-5 py-4 md:w-auto">
        <TierEmblem tier="UNRANKED" size={72} />
        <div>
          <p className="text-xs text-muted">{t.soloDuo}</p>
          <p className="text-2xl font-bold">{t.unranked}</p>
        </div>
      </div>
    );
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier);
  const games = solo.wins + solo.losses;
  const wr = games ? (solo.wins / games) * 100 : 0;
  const color = TIER_HEX[solo.tier] ?? "#5b6475";
  return (
    <div
      className="flex w-full items-center gap-4 rounded-xl border px-4 py-3 md:w-auto md:min-w-[22rem]"
      style={{
        borderColor: `${color}66`,
        background: `radial-gradient(120% 140% at 0% 50%, ${color}2e 0%, transparent 60%), var(--color-panel-2)`,
      }}
    >
      <TierEmblem tier={solo.tier} size={128} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.soloDuo}</p>
        <p className="text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color }}>
          {t.tiers[solo.tier] ?? solo.tier}
          {!apex && ` ${solo.rank}`}
        </p>
        <p className="mt-0.5 text-3xl font-black tabular-nums leading-tight sm:text-4xl">
          {solo.leaguePoints.toLocaleString(nl)}
          <span className="ml-1 text-base font-semibold text-muted">LP</span>
        </p>
        {!apex && (
          <div className="mt-2 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-black/30" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, solo.leaguePoints)}%`, background: color }} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {t.record(solo.wins.toLocaleString(nl), solo.losses.toLocaleString(nl))} · {dict(lang).winRate}{" "}
          <span className={wr >= 50 ? "text-win" : "text-lose"}>{wr.toFixed(1)}%</span>
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-md bg-panel-2 px-2 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className="text-lg font-bold"
        style={tone ? { color: tone === "up" ? "var(--chart-up)" : "var(--chart-down)" } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Cell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="text-right leading-tight">
      <span className="block text-[10px] text-muted sm:hidden">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className="block whitespace-nowrap text-xs font-semibold" style={{ color: up ? "var(--chart-up)" : "var(--chart-down)" }}>
      {up ? "▲" : "▼"}
      {Math.abs(value).toFixed(1)}
    </span>
  );
}

function SwList({
  title,
  empty,
  items,
  up = false,
  explain,
  label,
}: {
  title: string;
  empty: string;
  items: { metric: Metric; value: number }[];
  up?: boolean;
  explain: Record<Metric, (v: string) => string>;
  label: Record<Metric, string>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        <span style={{ color: up ? "var(--chart-up)" : "var(--chart-down)" }}>{up ? "▲" : "▼"}</span> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.metric} className="rounded-md bg-panel-2 px-3 py-2 text-sm">
              <span className="font-medium">{label[d.metric]}</span>{" "}
              <span className="text-xs text-muted">
                {d.value >= 0 ? "▲+" : "▼−"}
                {Math.abs(d.value).toFixed(1)}%
              </span>
              <p className="mt-0.5 text-muted">{explain[d.metric](Math.abs(d.value).toFixed(0))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 라인 게임들의 평균 스타일 (프로 비교용; deaths 는 판당)
function avgStyle(gs: Game[]) {
  const mean = (k: Metric) => gs.reduce((a, g) => a + g.me[k], 0) / (gs.length || 1);
  return { cs: mean("cs"), gold: mean("gold"), dmg: mean("dmg"), vision: mean("vision"), kp: mean("kp"), deaths: mean("deaths") };
}
