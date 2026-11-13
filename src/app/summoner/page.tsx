import type { Metadata } from "next";
import Link from "@/components/Link";
import ShareButton from "@/components/ShareButton";
import SinceLast from "@/components/SinceLast";
import SinceLastVisit from "@/components/SinceLastVisit";
import { Icon, Panel } from "@/components/ui";
import { DivergingBars } from "@/components/charts";
import TierEmblem from "@/components/TierEmblem";
import UpdateButton from "@/components/UpdateButton";
import ScoreCard from "@/components/ScoreCard";
import GrowthCard from "@/components/GrowthCard";
import ProMatch from "@/components/ProMatch";
import MatchList from "@/components/MatchList";
import LiveGame from "@/components/LiveGame";
import Achievements from "@/components/Achievements";
import { badges, bestGame, rankVsLobby } from "@/lib/achievements";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { growth } from "@/lib/growth";
import { rateMatch, scoreReport } from "@/lib/score";
import SummonerSearch from "@/components/SummonerSearch";
import SyncServer from "@/components/SyncServer";
import { getChampions, getPatches, getRuneTrees, getSummonerSpells, getVersion, img, type Champion } from "@/lib/ddragon";
import { ddLocale, dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import { boards } from "@/lib/stats";
import { fetchedAt } from "@/lib/summoner-cache";
import { LANES, SERVERS, laneLabel, parseServer, serverLabel, type Lane, type Server } from "@/lib/lanes";
import { getLang, getServer } from "@/lib/server";
import {
  lookupSummoner,
  matchTimelines,
  parseRiotId,
  RiotError,
  summonerTag,
  type LeagueEntry,
  type Lookup,
  type Match,
  type LookupError,
} from "@/lib/riot";
import {
  champSummaries,
  form,
  tilt,
  titles,
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

type Props = { searchParams: Promise<{ id?: string | string[]; s?: string }> };

const rawId = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v ?? "").slice(0, 60);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, lang, cookieServer] = await Promise.all([searchParams, getLang(), getServer()]);
  const server = sp.s ? parseServer(sp.s) : cookieServer;
  const t = dict(lang).summoner;
  const id = rawId(sp.id).trim();
  const card = id ? [{ url: `/api/card?id=${encodeURIComponent(id)}&s=${server}`, width: 1200, height: 630 }] : undefined;
  return { title: id ? t.metaTitle(id) : t.title, ...(card && { openGraph: { images: card }, twitter: { card: "summary_large_image" as const, images: card } }) };
}

// 서버에서 어디가 오래 걸리는지 보려고 단계별 시간을 숨은 표시로 남겨요 (page-check가 읽어요)
function Timing({ marks }: { marks: Record<string, number> }) {
  const end = Date.now();
  const t0 = marks.start;
  const out = Object.entries({ ...marks, render: end })
    .filter(([k]) => k !== "start")
    .map(([k, v]) => `${k}=${v - t0}`)
    .join(" ");
  return <span hidden data-timing={out} />;
}

// 아래쪽 패널은 한 박자 늦게 그려요. 무료 서버는 CPU가 느려서 페이지 전체를 다 그린 뒤 보내면 4초쯤 걸리는데,
// 이렇게 나누면 프로필·랭크·최근 6판이 먼저 화면에 뜨고 나머지가 뒤따라 와요.
async function LaterInner({ children }: { children: ReactNode }) {
  await new Promise((r) => setTimeout(r, 0));
  return <>{children}</>;
}
function Later({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <LaterInner>{children}</LaterInner>
    </Suspense>
  );
}

// 종합 점수 카드: 라인전 수치에 타임라인이 필요해서, 화면 나머지가 뜬 뒤 따로 받아 그려요
async function LaneScore({ server, matches, puuid, lang }: { server: Server; matches: Match[]; puuid: string; lang: Lang }) {
  // 타임라인은 한 판에 1~3MB라 읽는 동안 서버(CPU 0.1개)가 다른 요청을 못 받아요. 최근 4판만 써요.
  const ids = matches.filter((m) => m.info.gameDuration >= 300).slice(0, 4).map((m) => m.metadata.matchId);
  const timelines = await matchTimelines(server, ids).catch(() => ({}));
  const report = scoreReport(matches, puuid, timelines);
  return report ? <ScoreCard report={report} lang={lang} /> : null;
}

export default async function SummonerPage({ searchParams }: Props) {
  const marks: Record<string, number> = { start: Date.now() };
  const [sp, lang, cookieServer] = await Promise.all([searchParams, getLang(), getServer()]);
  // 공유된 링크는 서버(?s=)를 같이 담고 있어요
  const server = sp.s ? parseServer(sp.s) : cookieServer;
  const t = dict(lang).summoner;
  const raw = rawId(sp.id);
  // 로비 채팅이나 여러 명을 한 번에 붙여 넣으면 멀티서치로 보내요
  if (raw && /로비에|joined the lobby|[,，]/i.test(raw)) redirect(`/multi?s=${server}&q=${encodeURIComponent(raw)}`);
  const parsed = raw ? parseRiotId(raw, server) : null;

  const header = (
    <section className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>
      <SummonerSearch lang={lang} server={server} defaultValue={raw} />
      {server !== cookieServer && <SyncServer server={server} />}
    </section>
  );
  if (!parsed) return <div className="space-y-6">{header}</div>;

  const riotId = `${parsed.gameName}#${parsed.tagLine}`;
  let result: Lookup | null = null;
  let error: LookupError | null = null;
  try {
    result = await lookupSummoner(server, parsed.gameName, parsed.tagLine);
    marks.lookup = Date.now();
  } catch (e) {
    error = e instanceof RiotError ? e.kind : "error";
  }

  // 다른 서버 계정일 때가 많아서, 같은 이름으로 다른 서버를 한 번에 눌러 볼 수 있게 해요
  const otherServers = (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{lang === "ko" ? "다른 서버에서 찾기:" : "Try another server:"}</span>
      {SERVERS.filter((x) => x.id !== server).map((x) => (
        <Link
          key={x.id}
          href={`/summoner?id=${encodeURIComponent(parsed.defaultedTag ? parsed.gameName : riotId)}&s=${x.id}`}
          className="rounded-md bg-panel-2 px-3 py-1 hover:bg-line"
        >
          {serverLabel(x.id, lang)}
        </Link>
      ))}
    </div>
  );

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
          {error === "not-found" && otherServers}
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
  // 게임 목록에 쓰는 소환사 주문·룬 아이콘 (번호 → 이미지 주소)
  const [spellList, trees] = version
    ? await Promise.all([
        getSummonerSpells(version, ddLocale(lang)).catch(() => []),
        getRuneTrees(version, ddLocale(lang)).catch(() => []),
      ])
    : [[], []];
  marks.data = Date.now();
  const spellIcons: Record<number, string> = {};
  for (const sp of spellList) spellIcons[Number(sp.key)] = img.spell(version!, sp.image.full);
  const runeIcons: Record<number, string> = {};
  for (const tr of trees) {
    runeIcons[tr.id] = img.rune(tr.icon);
    for (const slot of tr.slots) for (const r of slot.runes) runeIcons[r.id] = img.rune(r.icon);
  }
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
      <Suspense fallback={null}>
        <LiveGame
          server={server}
          puuid={result.account.puuid}
          lang={lang}
          tags={[summonerTag(server, parsed.gameName, parsed.tagLine)]}
          spellIcons={spellIcons}
        />
      </Suspense>
      <Analysis
        result={result}
        lang={lang}
        server={server}
        version={version}
        champions={champions}
        patches={patches}
        tagNote={tagNote}
        otherServers={otherServers}
        update={update}
        spellIcons={spellIcons}
        runeIcons={runeIcons}
      />
      <Timing marks={marks} />
    </div>
  );
}

const fix = (v: number, d = 1) => v.toFixed(d);
const tiltLevelOf = (score: number) => (score < 15 ? 0 : score < 35 ? 1 : score < 55 ? 2 : score < 75 ? 3 : 4);
// 지금 큐 판정: 연패 중이거나 멘탈 지수가 높으면 쉬라고 해요
const queueLevelOf = (tl: { lossRun: number; score: number }) =>
  tl.lossRun >= 2 || tl.score >= 55 ? 2 : tl.score >= 35 || tl.lossRun === 1 ? 1 : 0;

function Analysis({
  result,
  lang,
  server,
  version,
  champions,
  patches,
  tagNote,
  otherServers,
  update,
  spellIcons,
  runeIcons,
}: {
  result: Lookup;
  lang: Lang;
  server: Server;
  version: string | null;
  champions: Champion[];
  patches: string[];
  update: React.ReactNode;
  tagNote: React.ReactNode;
  otherServers: React.ReactNode;
  spellIcons: Record<number, string>;
  runeIcons: Record<number, string>;
}) {
  const t = dict(lang).summoner;
  const nl = numLocale(lang);
  const { account, profile, solo } = result;
  const games = toGames(result.matches, account.puuid);

  // 헤더 한 줄: 이름(+버튼) | 솔랭 티어·LP | 최근 10판 승패 + 칭찬 한 줄. 아래 빈 줄 없이 꽉 채워요.
  const profileHeader = (glance?: React.ReactNode) => (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="relative shrink-0">
          {version && profile ? (
            <Icon src={img.profileIcon(version, profile.profileIconId)} alt="" size={72} className="rounded-xl bg-panel-2" />
          ) : (
            <div className="h-[72px] w-[72px] rounded-xl bg-panel-2" />
          )}
          {profile && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line bg-bg px-2 text-[11px] font-semibold tabular-nums">
              {profile.summonerLevel.toLocaleString(nl)}
            </span>
          )}
        </div>
        <div className="min-w-0 basis-56 flex-1 sm:flex-none">
          <p className="break-words text-xl font-bold">
            {account.gameName} <span className="font-normal text-muted">#{account.tagLine}</span>
          </p>
          <p className="text-sm text-muted">
            {serverLabel(server, lang)}
            {profile && ` · ${t.level(profile.summonerLevel.toLocaleString(nl))}`}
          </p>
          <div className="mt-2.5 flex flex-wrap items-start gap-2">
            <ShareButton url={`/summoner?id=${encodeURIComponent(`${account.gameName}#${account.tagLine}`)}&s=${server}`} title={t.metaTitle(`${account.gameName}#${account.tagLine}`)} label={t.shareLabel} copied={t.shareCopied} />
            {update}
          </div>
        </div>
        <div className="hidden self-stretch border-l border-line md:block" aria-hidden />
        <RankBox solo={solo} lang={lang} who={`${account.puuid}`} />
        {glance && (
          <>
            <div className="hidden self-stretch border-l border-line lg:block" aria-hidden />
            {glance}
          </>
        )}
      </div>
    </Panel>
  );

  if (!games.length)
    return (
      <>
        {profileHeader()}
        {tagNote}
        <Panel>
          <p className="text-sm">
            {t.noGames}{" "}
            {lang === "ko"
              ? `지금은 ${serverLabel(server, lang)} 서버에서 찾았어요. 다른 서버 계정이면 아래를 눌러 주세요.`
              : `This searched ${serverLabel(server, lang)}. If the account plays on another server, pick it below.`}
          </p>
          {otherServers}
        </Panel>
      </>
    );

  const avg = siteAverages(server);
  const champs = champSummaries(games, champions, avg);
  const roleList = roles(games);
  const lanes = laneDiffs(games);
  const sw = strengthsWeaknesses(lanes.diffs);
  const f = form(games);
  const tl = tilt(games);
  const score = scoreReport(result.matches, account.puuid, result.timelines);
  const mainLane = roleList[0]?.lane ?? null;
  const laneName = (l: Lane) => laneLabel(l, lang);
  const total = games.length;
  // 다시 왔을 때 비교할 요약 (브라우저에 저장)
  const snap = {
    last: games[0]?.endedAt ?? 0,
    wr: total ? (games.filter((g) => g.win).length / total) * 100 : 0,
    kda: games.reduce((a, g) => a + g.kills + g.assists, 0) / Math.max(1, games.reduce((a, g) => a + g.deaths, 0)),
    cs: total ? games.reduce((a, g) => a + g.csPerMin, 0) / total : 0,
  };

  // 요약 문장 (규칙 기반)
  const record = (c: ChampSummary) => t.champRecord(c.championName, c.wins, c.games - c.wins, fix(c.winRate, 0));
  const enough = champs.filter((c) => c.games >= 3);
  const best = [...enough].filter((c) => c.winRate >= 50).sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, 2);
  const avoid = enough.filter((c) => c.winRate < 45).sort((a, b) => a.winRate - b.winRate).slice(0, 2);
  const s0 = sw.strengths[0];
  const w0 = sw.weaknesses[0];
  const g = t.glance;
  const wins = games.filter((x) => x.win).length;
  const top3 = [...champs].sort((a, b) => b.games - a.games).slice(0, 3);
  // 들어오자마자 기분 좋은 한 줄: 강점 → 잘 맞는 챔피언 → 연승 순으로 찾아요
  const praise = s0
    ? g.good(t.metricNames[s0.metric], fix(s0.value, 0))
    : best[0]
      ? g.goodChamp(best[0].championName, fix(best[0].winRate, 0))
      : f.streak?.win && f.streak.count >= 2
        ? g.goodStreak(f.streak.count)
        : g.steady;
  const last10 = games.slice(0, 10);
  const w10 = last10.filter((x) => x.win).length;
  const glance = (
    <div className="min-w-0 basis-64 flex-1">
      <p className="mb-1.5 text-xs text-muted">
        {g.recent(last10.length)} <b className="text-text">{g.record(w10, last10.length - w10)}</b>
      </p>
      <div className="flex flex-wrap gap-1" aria-label={g.record(w10, last10.length - w10)}>
        {[...last10].reverse().map((x) => (
          <span
            key={x.id}
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ background: x.win ? "var(--chart-up)" : "var(--chart-down)" }}
          >
            {x.win ? t.winShort : t.lossShort}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--chart-up)" }}>
        {praise}
      </p>
      <a href="#analysis" className="mt-1 inline-block text-sm font-semibold text-accent hover:underline">
        {g.toAnalysis}
      </a>
    </div>
  );
  // 오른쪽 위 요약 막대: 승률 도넛 + KDA + 모스트 3 + 지표 칩 4개
  const avgK = games.reduce((a, x) => a + x.kills, 0) / total;
  const avgD = games.reduce((a, x) => a + x.deaths, 0) / total;
  const avgA = games.reduce((a, x) => a + x.assists, 0) / total;
  const inbuns = result.matches.flatMap((m) => rateMatch(m).filter((r) => r.puuid === account.puuid).map((r) => r.inbun));
  const avgInbun = inbuns.length ? inbuns.reduce((a, v) => a + v, 0) / inbuns.length : null;
  const laneEdge = lanes.diffs.length ? lanes.diffs.reduce((a, d) => a + d.value, 0) / lanes.diffs.length : null;
  const wrPct = (wins / total) * 100;
  const R = 26;
  const C = 2 * Math.PI * R;
  const chip = (label: string, value: React.ReactNode, tone?: "up" | "down") => (
    <div className="flex items-center justify-between gap-2 rounded-md bg-panel-2 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-bold tabular-nums" style={tone ? { color: tone === "up" ? "var(--chart-up)" : "var(--chart-down)" } : undefined}>
        {value}
      </span>
    </div>
  );
  const summaryBar = (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${g.winRate} ${fix(wrPct, 0)}%`}>
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--chart-down)" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="var(--chart-up)"
              strokeWidth="7"
              strokeDasharray={`${(wrPct / 100) * C} ${C}`}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">
              {fix(wrPct, 0)}%
            </text>
          </svg>
          <div className="leading-tight">
            <p className="text-sm text-muted">{g.games(total, wins, total - wins)}</p>
            <p className="text-xl font-bold tabular-nums">{fix(snap.kda, 2)} KDA</p>
            <p className="text-xs text-muted tabular-nums">
              {fix(avgK)} / <span style={{ color: "var(--chart-down)" }}>{fix(avgD)}</span> / {fix(avgA)}
            </p>
          </div>
        </div>
        {top3.length > 0 && (
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs text-muted">{g.most3}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {top3.map((c) => (
                <li key={c.championId} className="flex items-center gap-2">
                  {version && c.champion ? (
                    <Icon src={img.champion(version, c.champion.image.full)} alt={c.championName} size={40} className="rounded-md" />
                  ) : (
                    <span className="h-10 w-10 rounded-md bg-panel-2" />
                  )}
                  <span className="leading-tight">
                    <span className="block text-sm font-bold tabular-nums" style={{ color: c.winRate >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                      {fix(c.winRate, 0)}%
                    </span>
                    <span className="block text-xs text-muted">{g.record(c.wins, c.games - c.wins)}</span>
                    <span className="block text-xs text-muted">{fix(c.kda, 2)} KDA</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {chip(g.lane, laneEdge === null ? "-" : `${laneEdge >= 0 ? "+" : "−"}${fix(Math.abs(laneEdge), 0)}%`, laneEdge === null ? undefined : laneEdge >= 0 ? "up" : "down")}
        {chip(g.inbun, avgInbun === null ? "-" : g.inbunVal(fix(avgInbun)), avgInbun === null ? undefined : avgInbun >= 1 ? "up" : "down")}
        {chip(g.mental, tl ? `${tl.score} · ${t.tiltLevels[tiltLevelOf(tl.score)]}` : "-", tl ? (tl.score >= 55 ? "down" : tl.score < 35 ? "up" : undefined) : undefined)}
        {chip(g.queue, tl ? g.queueShort[queueLevelOf(tl)] : "-", tl ? (queueLevelOf(tl) === 2 ? "down" : queueLevelOf(tl) === 0 ? "up" : undefined) : undefined)}
      </div>
    </Panel>
  );
  // 왼쪽: 포지션 비율 (라인별 비율·승률·게임 수)
  const laneRows = LANES.map((l) => {
    const gs = games.filter((x) => x.lane === l.id);
    return { lane: l.id, n: gs.length, wr: gs.length ? (gs.filter((x) => x.win).length / gs.length) * 100 : 0 };
  });
  const positionsPanel = (
    <Panel title={g.positions}>
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-x-1 gap-y-1.5 text-center text-xs tabular-nums">
        <span />
        {laneRows.map((r) => (
          <span key={r.lane} className={`truncate font-semibold ${r.lane === mainLane ? "text-accent" : "text-muted"}`}>
            {laneName(r.lane)}
          </span>
        ))}
        <span className="text-left text-muted">{g.share}</span>
        {laneRows.map((r) => (
          <span key={r.lane} className={r.lane === mainLane ? "font-bold" : ""}>{r.n ? `${fix((r.n / total) * 100, 0)}%` : "-"}</span>
        ))}
        <span className="text-left text-muted">{g.winRate}</span>
        {laneRows.map((r) => (
          <span key={r.lane} style={r.n ? { color: r.wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" } : undefined}>
            {r.n ? `${fix(r.wr, 0)}%` : "-"}
          </span>
        ))}
        <span className="text-left text-muted">{g.gamesCol}</span>
        {laneRows.map((r) => (
          <span key={r.lane} className="text-muted">{r.n || "-"}</span>
        ))}
      </div>
    </Panel>
  );
  // 최근 솔로랭크에서 2판 이상 같은 팀이었던 사람 (op.gg "최근 같이 플레이한 소환사")
  const mates = new Map<string, { id: string; games: number; wins: number }>();
  for (const m of result.matches) {
    const me = m.info.participants.find((p) => p.puuid === account.puuid);
    if (!me) continue;
    for (const p of m.info.participants) {
      if (p.puuid === account.puuid || p.teamId !== me.teamId || !p.riotIdGameName || !p.riotIdTagline) continue;
      const cur = mates.get(p.puuid) ?? { id: `${p.riotIdGameName}#${p.riotIdTagline}`, games: 0, wins: 0 };
      cur.games++;
      if (me.win) cur.wins++;
      mates.set(p.puuid, cur);
    }
  }
  const mateRows = [...mates.values()].filter((m) => m.games >= 2).sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, 5);
  const matesPanel = mateRows.length > 0 && (
    <Panel title={lang === "ko" ? "최근 같이 플레이한 소환사" : "Recently played with"}>
      <ul className="-mx-1 space-y-0.5">
        {mateRows.map((m) => (
          <li key={m.id}>
            <Link
              href={`/summoner?id=${encodeURIComponent(m.id)}&s=${server}`}
              className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-panel-2"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{m.id}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {lang === "ko" ? `${m.games}판 ${m.wins}승 ${m.games - m.wins}패` : `${m.games}g ${m.wins}W ${m.games - m.wins}L`}
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: m.wins * 2 >= m.games ? "var(--chart-up)" : "var(--chart-down)" }}>
                {Math.round((m.wins / m.games) * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
  const mostPanel = (
    <Panel title={g.mostChamps}>
      <ul className="-mx-1 space-y-0.5">
        {champs.slice(0, 10).map((c) => (
          <li key={c.championId}>
            <Link
              href={c.champion ? `/champions/${c.champion.id}${c.lane ? `?lane=${c.lane}` : ""}` : "#"}
              className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-panel-2"
            >
              {version && c.champion ? (
                <Icon src={img.champion(version, c.champion.image.full)} alt="" size={32} className="rounded-md" />
              ) : (
                <span className="h-8 w-8 rounded-md bg-panel-2" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.championName}</span>
              <span className="w-14 text-right text-xs tabular-nums text-muted">{fix(c.kda, 2)} KDA</span>
              <span className="w-14 text-right leading-tight tabular-nums">
                <span className="block text-sm font-bold" style={{ color: c.winRate >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                  {fix(c.winRate, 0)}%
                </span>
                <span className="block text-[11px] text-muted">{t.gameCount(c.games)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
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
  const myTitles = titles(games);
  const titlesPanel = myTitles.length > 0 && (
    <Panel>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{t.titlesTitle}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {myTitles.map((id) => (
          <li key={id} className="rounded-xl bg-panel-2 px-3 py-2">
            <p className="font-bold">{t.titleNames[id][0]}</p>
            <p className="text-xs text-muted">{t.titleNames[id][1]}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t.titlesNote}</p>
    </Panel>
  );
  const tiltLevel = tl ? tiltLevelOf(tl.score) : 0;
  const queueLevel = tl ? queueLevelOf(tl) : 0;
  const verdictColor = queueLevel === 2 ? "var(--chart-down)" : queueLevel === 0 ? "var(--chart-up)" : undefined;
  const meterColor = tl && tl.score >= 55 ? "var(--chart-down)" : "var(--chart-up)";
  // 연패 수는 아래 "지금 흐름"에서 말하니까 여기서는 빼요 (같은 말 두 번 안 하기)
  const whyRaw = tl ? t.tiltWhy(0, fix(tl.avg5), fix(tl.avgAll), tl.feeds, tl.quick) : "";
  const why = whyRaw.charAt(0).toUpperCase() + whyRaw.slice(1);
  const tiltPanel = tl && (
    <Panel>
      <h2 className="text-base font-bold">{t.queueAsk}</h2>
      <p className="mt-1 text-xl font-bold leading-snug" style={{ color: verdictColor }}>
        {t.queueVerdict[queueLevel]}
      </p>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-sm text-muted">{t.tiltTitle}</span>
        <span className="text-2xl font-bold tabular-nums" style={{ color: tl.score >= 55 ? meterColor : tl.score < 35 ? meterColor : undefined }}>
          {tl.score}
        </span>
        <span className="text-sm text-muted">/ 100 · {t.tiltLevels[tiltLevel]}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2" role="img" aria-label={`${t.tiltTitle} ${tl.score}/100`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, tl.score)}%`, background: meterColor }} />
      </div>
      {(why || tl.afterLoss || tl.afterWin) && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {why && <li>{why}</li>}
          {tl.afterLoss && <li>{t.tiltAfterLoss(fix(tl.afterLoss.rate, 0), tl.afterLoss.n)}</li>}
          {tl.afterWin && <li>{t.tiltAfterWin(fix(tl.afterWin.rate, 0), tl.afterWin.n)}</li>}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">{t.tiltNote}</p>
    </Panel>
  );
  const nowPanel = (
    <Panel>
      <h2 className="text-base font-bold">{t.nowTitle}</h2>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-lg font-semibold leading-snug" style={flowTone ? { color: flowTone === "up" ? "var(--chart-up)" : "var(--chart-down)" } : undefined}>
            {flow}
          </p>
          <div className="mt-3 flex gap-1" aria-hidden>
            {[...last5].reverse().map((g) => (
              <span
                key={g.id}
                className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white"
                style={{ background: g.win ? "var(--chart-up)" : "var(--chart-down)" }}
              >
                {g.win ? t.winShort : t.lossShort}
              </span>
            ))}
          </div>
        </div>
        {pick && (
          <div className="flex items-start gap-3">
            {pick.champ && version && (
              <Icon src={img.champion(version, pick.champ.image.full)} alt={pick.name} size={48} className="rounded-md" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-snug">{pick.text}</p>
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
        )}
      </div>
      <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line pt-4 text-sm md:grid-cols-2">
        <div>
          <dt className="text-muted">{t.goalLabel}</dt>
          <dd className="mt-0.5 font-medium">{goal}</dd>
        </div>
        {rest && (
          <div>
            <dt className="text-muted">{t.avoidLabel}</dt>
            <dd className="mt-0.5 font-medium" style={{ color: "var(--chart-down)" }}>
              {t.avoidText(rest.championName, rest.wins, rest.games - rest.wins)}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );

  return (
    <>
      {profileHeader(glance)}
      <Achievements
        badges={badges(result.matches, account.puuid)}
        best={bestGame(result.matches, account.puuid)}
        ranks={rankVsLobby(result.matches, account.puuid)}
        lang={lang}
        version={version}
        shareUrl={`/summoner?id=${encodeURIComponent(`${account.gameName}#${account.tagLine}`)}&s=${server}`}
        shareTitle={t.metaTitle(`${account.gameName}#${account.tagLine}`)}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* 휴대폰에서는 요약·최근 게임을 먼저 보여 주고 포지션·모스트 챔피언은 그 아래로 (화면이 한 줄일 때) */}
        <aside className="order-2 space-y-4 lg:order-none">
          <Later fallback={<div className="h-80 animate-pulse rounded-lg bg-panel" />}>
            {positionsPanel}
            {mostPanel}
            {matesPanel}
          </Later>
        </aside>
        <div className="order-1 min-w-0 space-y-4 lg:order-none">
          {summaryBar}
          <SinceLastVisit id={`${server}:${account.puuid}`} now={snap} labels={{ ...t.since, since: t.since.since("{date}") }} locale={nl} />
          <MatchList
            matches={result.matches}
            puuid={account.puuid}
            version={version}
            champions={champions}
            lang={lang}
            server={server}
            spellIcons={spellIcons}
            runeIcons={runeIcons}
            to={6}
            more={
              <Later fallback={<div className="mt-2 h-96 animate-pulse rounded-lg bg-panel-2" />}>
                <MatchList
                  matches={result.matches}
                  puuid={account.puuid}
                  version={version}
                  champions={champions}
                  lang={lang}
                  server={server}
                  spellIcons={spellIcons}
                  runeIcons={runeIcons}
                  from={6}
                  bare
                />
              </Later>
            }
          />
          <div className="space-y-1 text-xs text-muted">
            <p>{t.analyzed(total, result.matchIds)}</p>
            {tagNote}
          </div>
          <div id="analysis" className="scroll-mt-20" aria-hidden />
          {tiltPanel}
          <Later fallback={<div className="h-64 animate-pulse rounded-lg bg-panel" />}>
          {nowPanel}
          {titlesPanel}
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

      {result.mastery.length > 0 && (
        <Panel title={lang === "ko" ? "챔피언 숙련도 TOP 5" : "Top 5 champion mastery"}>
          <ul className="grid gap-2 sm:grid-cols-5">
            {result.mastery.map((m) => {
              const c = champions.find((x) => x.key === String(m.championId));
              return (
                <li key={m.championId} className="flex items-center gap-3 rounded-lg bg-panel-2 p-3 sm:flex-col sm:text-center">
                  {version && c && <Icon src={img.champion(version, c.image.full)} alt={c.name} size={44} className="rounded-lg" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.name ?? m.championId}</p>
                    <p className="text-xs text-muted">
                      {lang === "ko" ? `숙련도 ${m.championLevel}레벨` : `Mastery ${m.championLevel}`}
                    </p>
                    <p className="text-sm font-bold text-accent">{m.championPoints.toLocaleString(nl)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {score && (
        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-panel" />}>
          <LaneScore server={server} matches={result.matches} puuid={account.puuid} lang={lang} />
        </Suspense>
      )}

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
          </Later>
        </div>
      </div>
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

// 헤더 안에 들어가는 솔랭 티어 (엠블럼 + 티어·LP + 전적)
function RankBox({ solo, lang, who }: { solo: LeagueEntry | null; lang: Lang; who: string }) {
  const t = dict(lang).summoner;
  const nl = numLocale(lang);
  if (!solo)
    return (
      <div className="flex shrink-0 items-center gap-3">
        <TierEmblem tier="UNRANKED" size={56} />
        <div>
          <p className="text-lg font-bold leading-tight">{t.unranked}</p>
          <p className="text-xs text-muted">{t.soloDuo}</p>
        </div>
      </div>
    );
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier);
  const games = solo.wins + solo.losses;
  const wr = games ? (solo.wins / games) * 100 : 0;
  const color = TIER_HEX[solo.tier] ?? "#5b6475";
  return (
    <div className="flex shrink-0 items-center gap-3">
      <TierEmblem tier={solo.tier} size={64} />
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-tight">
          <span style={{ color }}>
            {t.tiers[solo.tier] ?? solo.tier}
            {!apex && ` ${solo.rank}`}
          </span>{" "}
          <span className="font-semibold tabular-nums text-muted">{solo.leaguePoints.toLocaleString(nl)} LP</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {t.soloDuo} · {dict(lang).winRate}{" "}
          <span className={`font-semibold ${wr >= 50 ? "text-win" : "text-lose"}`}>{wr.toFixed(0)}%</span>{" "}
          ({t.record(solo.wins.toLocaleString(nl), solo.losses.toLocaleString(nl))})
        </p>
        <SinceLast who={who} tier={solo.tier} rank={solo.rank} lp={solo.leaguePoints} wins={solo.wins} losses={solo.losses} ko={lang === "ko"} />
      </div>
    </div>
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
