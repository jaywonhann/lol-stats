// 화면 문구 사전 (영어 기본, 한국어). 클라이언트 컴포넌트에서도 쓰므로 next/headers를 가져오지 않습니다.
import type { Lane, Rank, Server } from "./lanes";

type Metric = "cs" | "gold" | "dmg" | "vision" | "kp" | "deaths";
type ByMetric<T> = Record<Metric, T>;

export type Lang = "en" | "ko";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
];

export const parseLang = (v?: string): Lang => (v === "ko" ? "ko" : "en");

export const numLocale = (lang: Lang) => (lang === "ko" ? "ko-KR" : "en-US");

export const ddLocale = (lang: Lang) => (lang === "ko" ? "ko_KR" : "en_US");

const en = {
  siteTitle: "livelol.stats - LoL champion stats",
  siteDescription:
    "League of Legends champion tier list, builds, runes and counters",
  nav: {
    tier: "Tier List",
    trends: "Patch Trends",
    meta: "Meta Chart",
    summoner: "Summoner",
    faq: "FAQ",
  },
  footerFeedback: "Have feedback? Tell us",
  mockBanner:
    "We're still collecting real games for this server, so the win rates, pick rates and ranks shown are sample data. They'll switch to real stats and builds once enough games are in.",
  server: "Server",
  language: "Language",
  lanes: {
    top: "Top",
    jungle: "Jungle",
    mid: "Mid",
    bottom: "Bot",
    support: "Support",
  } satisfies Record<Lane, string>,
  ranks: {
    all: "Emerald+ (all)",
    emerald: "Emerald",
    diamond: "Diamond",
    master: "Master+",
  } satisfies Record<Rank, string>,
  servers: {
    kr: "Korea",
    na1: "North America",
    euw1: "Europe West",
  } satisfies Record<Server, string>,
  emeraldPlus: "Emerald+",
  tier: (t: string) => (t === "OP" ? "OP" : `Tier ${t}`),
  serverName: (s: string) => s,
  patch: (p: string) => `Patch ${p}`,
  games: (n: string) => `${n} games`,
  winRate: "Win rate",
  pickRate: "Pick rate",
  banRate: "Ban rate",
  metaScore: "Meta score",
  rank: "Rank",
  champion: "Champion",
  tierCol: "Tier",
  gamesCol: "Games",
  sampleData: "Sample data",
  notEnoughSample: "Not enough games yet.",
  // 상대 시간
  minutesAgo: (n: number) => `${n}m ago`,
  hoursAgo: (n: number) => `${n}h ago`,
  daysAgo: (n: number) => `${n}d ago`,
  withinHour: "within the last hour",
  updated: (ago: string) => `updated ${ago}`,
  notFound: "Page not found",
  backHome: "Back to home",
  // 홈
  homeSubtitle: (server: string, patch: string) =>
    `${server} · Champion tiers, builds, runes and counters for patch ${patch}`,
  bestPicks: (lane: string) => `Best ${lane} picks`,
  heroTagline: "See what's winning right now.",
  heroFeatured: (name: string, lane: string) => `Top pick right now · ${name} ${lane}`,
  bestPicksTitle: "Best picks by lane",
  viewAll: "View all",
  risingOnPatch: (p: string) => `Rising on patch ${p}`,
  fallingOnPatch: (p: string) => `Falling on patch ${p}`,
  viewAllTrends: "View all patch trends",
  championSearch: "Champion search",
  hotBuildVideos: "Trending build videos",
  hotBuildNote: "Most-viewed League build videos on YouTube lately. Click to play here.",
  views: (n: string) => `${n} views`,
  searchPlaceholder: "Search champions (e.g. Ahri)",
  noResults: "No champions found.",
  // LIVE 패널
  liveSubtitle: (server: string, updated: string | null) =>
    `${server}${updated ? ` · ${updated}` : ""}`,
  gamesUnit: "games",
  last24h: (server: string) => `${server} ranked games analyzed in the last 24h`,
  gamesByHour: "Games per hour",
  hourLabel: (h: number) => `${h}:00`,
  hourTitle: (h: number, n: number) => `${h}:00: ${n} games`,
  gamesByHourKst: "Games per hour (KST)",
  activityCollecting:
    "Collecting games for this server. The 24h game count will appear once collection finishes.",
  liveUnavailable: "Live player count isn't available yet.",
  liveChecking: "Checking how many players are in game…",
  playersUnit: "players",
  liveHeroTitle: "Players in game right now",
  liveVsHour: "vs 1 hour ago",
  liveChampsTitle: "Most played right now",
  liveChampsNote: (games: number, h: number) =>
    `Split by the picks in ${games} live ranked games sampled in the last ${h === 1 ? "hour" : `${h} hours`} (estimate)`,
  liveChampsGames: (n: number) => `in ${n} game${n === 1 ? "" : "s"}`,
  liveChampsPlayers: "{n} players",
  liveChampsTotal: "What the {n} players in game right now are playing",
  liveChampsSum: "{n} champions · adds up to {total} players",
  liveChampsMore: "Show all {n} champions",
  liveChampsLess: "Show top 10",
  liveChampsEmpty: "Collecting live games. Check back in a few minutes.",
  liveJust: "just now",
  liveNext: (s: number) => `next update in ${s}s`,
  liveRange: (h: number) => `Last ${h}h`,
  liveNow: "now",
  liveFromHistory: "Showing the last recorded number.",
  liveCaption: (total: string) =>
    `Master+ players in game now (estimate, of ${total})`,
  liveAria: "Live player count trend",
  livePointTitle: (time: string, n: number) => `${time} ~${n} players`,
  liveFoot:
    "Live number updates every minute, graph recorded every 10 min · estimated from a sample of Master+ players",
  // 티어 리스트
  tierTitle: "Champion Tier List",
  soloGames: (n: string) => `${n} Ranked Solo games`,
  // 패치 트렌드
  trendsTitle: "Patch Trends",
  scoreChangeDetail: (score: string, wr: string) =>
    `Meta score ${score}, win rate ${wr}%`,
  scoreChangeRange: (prev: string, patch: string) =>
    `Patch ${prev} → ${patch} meta score change`,
  realGames: "Real games",
  trendsFirstPatch:
    "We started collecting real data this patch. Champions that rose or fell will show up here once next patch's data comes in.",
  scoreChangeChart: "Biggest meta score changes (▲ up · ▼ down)",
  rising: "Rising",
  falling: "Falling",
  sparkCaption: (n: number, a: string, b: string) =>
    `Chart: win rate over the last ${n === 1 ? "patch" : `${n} patches`} (${a}–${b})`,
  noMatches: "No champions match.",
  // 챔피언
  champMetaTitle: (name: string) => `${name} Build, Runes & Counters`,
  sourceReal: " · Ranked Solo games",
  sourceMock: " · win/pick rates are sample data",
  patchTrend: (n: number) => `Patch trend (last ${n} patches)`,
  laneRank: (lane: string) => `${lane} rank`,
  rankSuffix: "",
  topBuilds: "Top builds right now",
  topBuildsNote: (games: string, updated: string | null) =>
    `Based on ${games} recent games${updated ? ` · ${updated}` : ""} · popular options sorted by win rate · low-sample options excluded`,
  keystoneSecondary: "Keystone + secondary tree",
  coreFirstTwo: "Core items (first 2 completed)",
  boots: "Boots",
  buildTrend: "Build win rate over time",
  buildTrendNote: (window: number, server: string) =>
    `Daily win rate of popular core item pairs (first 2 completed) · ${window}-day moving average · ${server} Emerald+ · days with few games are bridged from neighbouring days`,
  recRunes: "Recommended runes",
  coreItems: "Core items",
  corePath: "Build path (1st–4th core)",
  coreSlot: (n: number) => ["1st", "2nd", "3rd", "4th"][n - 1] + " core",
  fullBuilds: "Popular core builds (in order)",
  pickShort: "Pick",
  matchupNote: "Few games per matchup so far, so the order also weighs sample size.",
  startingItems: "Starting items",
  summonerSpells: "Summoner spells",
  skillOrder: "Skill order",
  easyMatchups: "Easy matchups",
  hardMatchups: "Hard matchups",
  buildRunesCounters: "Builds · Runes · Counters",
  noBuildLane: (name: string, lane: string) =>
    `Not enough ${name} ${lane} games yet this patch. Real builds will show up once more games come in.`,
  noBuildYet:
    "Once we start collecting real ranked games, the runes, items, spells, skill order and counters top players actually use will show up here.",
  // 메타 차트
  metaTitle: "Meta Chart",
  metaSubtitle: (server: string, window: number) =>
    `${server} · Emerald+ · daily pick rate (${window}-day moving average)`,
  metaIntro: (window: number) =>
    `Like a stock chart: champions being picked more and less lately. Compares the last ${window} days' pick rate with the ${window} days before.`,
  metaCollecting:
    "Collecting daily records for this server. The chart will appear after the next collection run (every 6 hours).",
  pickRising: "▲ Pick rate rising",
  pickFalling: "▼ Pick rate falling",
  noNotableChange: "No notable changes yet.",
  metaCardTitle: (name: string, rate: string, window: number, games: number) =>
    `${name} pick rate ${rate}% (${games} games in the last ${window} days)`,
  // 소환사 검색
  summoner: {
    title: "Summoner Search",
    metaTitle: (id: string) => `${id} - Summoner analysis`,
    intro:
      "Enter a Riot ID to see recent Ranked Solo win rates, best champions, strengths and what to work on.",
    inputLabel: "Riot ID",
    placeholder: "e.g. Hide on bush#KR1",
    search: "Search",
    searching: (server: string) =>
      `Searching ${server}. You can change the server at the top right.`,
    tagHint: (tag: string) =>
      `Include the tag after # (e.g. Hide on bush#KR1). If you leave it out, we use #${tag}.`,
    defaultedTag: (tag: string) =>
      `No tag was given, so we searched with #${tag}.`,
    notFound: (id: string, server: string) =>
      `We couldn't find ${id} on ${server}. Check the spelling and the tag after #, or switch server at the top right.`,
    rateLimited: "Too many lookups right now. Please try again in a minute.",
    unavailable: "Summoner search isn't available right now.",
    error:
      "We couldn't reach Riot's servers just now. Please try again shortly.",
    noGames: "No recent Ranked Solo games found for this player.",
    level: (n: string) => `Level ${n}`,
    soloDuo: "Ranked Solo/Duo",
    unranked: "Unranked",
    lp: (n: string) => `${n} LP`,
    record: (w: string, l: string) => `${w}W ${l}L`,
    tiers: {
      IRON: "Iron",
      BRONZE: "Bronze",
      SILVER: "Silver",
      GOLD: "Gold",
      PLATINUM: "Platinum",
      EMERALD: "Emerald",
      DIAMOND: "Diamond",
      MASTER: "Master",
      GRANDMASTER: "Grandmaster",
      CHALLENGER: "Challenger",
    } as Record<string, string>,
    analyzed: (n: number, total: number) =>
      n === total
        ? `Analyzed ${n} recent Ranked Solo games`
        : `Analyzed ${n} of the last ${total} Ranked Solo games (the rest couldn't be loaded)`,
    summary: "Summary",
    sumRole: (lane: string, n: number, total: number) =>
      `You mostly play ${lane} (${n} of ${total} games).`,
    sumBest: (list: string) => `Best champions to queue right now: ${list}.`,
    sumBestNone:
      "Play at least 3 games on a champion to see which ones to queue most.",
    sumAvoid: (list: string) =>
      `Consider benching ${list} for now (under 45% win rate).`,
    sumStrength: (label: string, v: string) =>
      `Biggest strength: ${label} (▲${v}% vs. your lane opponent).`,
    sumWeakness: (label: string, v: string) =>
      `Biggest weakness: ${label} (▼${v}% vs. your lane opponent).`,
    sumForm: (w: number, l: number, wr: string, streak: string) =>
      `Recent form: ${w}W ${l}L (${wr}% win rate)${streak}.`,
    sumStreak: (win: boolean, n: number) =>
      n >= 2 ? `, on a ${n}-game ${win ? "win" : "losing"} streak` : "",
    champRecord: (name: string, w: number, l: number, wr: string) =>
      `${name} (${w}W ${l}L, ${wr}%)`,
    form: "Recent form",
    formNote:
      "Riot's API doesn't share LP history, so this graph stands in for a tier graph: it climbs one step per win and drops one per loss.",
    formAria: (w: number, l: number) =>
      `Win/loss trend over recent games: ${w} wins, ${l} losses`,
    oldest: "Oldest",
    latest: "Latest",
    recentWinRate: "Recent win rate",
    currentStreak: "Current streak",
    streak: (win: boolean, n: number) => `${n}${win ? "W" : "L"}`,
    net: "Net wins",
    winShort: "W",
    lossShort: "L",
    gameTitle: (champ: string, win: boolean, kda: string) =>
      `${win ? "Win" : "Loss"} · ${champ} · ${kda}`,
    gameCount: (n: number) => (n === 1 ? "1 game" : `${n} games`),
    mostPlayed: "Most played champions",
    games: "Games",
    kda: "KDA",
    csMin: "CS/min",
    lane: "Lane",
    siteAvg: "Site avg",
    siteAvgVal: (v: string) => `avg ${v}%`,
    siteAvgNote: (server: string, patch: string) =>
      `Site avg = ${server} Emerald+ win rate for that champion and lane on patch ${patch}.`,
    noSiteAvg: "Site averages for this server will appear once enough games are collected.",
    roles: "Roles played",
    laneVs: "Strengths & weaknesses",
    laneVsCaption: (n: number) =>
      `Vs. the enemy in your position, average of ${n} games (▲ better · ▼ worse)`,
    noLaneVs: "Not enough games with a clear lane opponent yet.",
    metrics: {
      cs: "CS/min",
      gold: "Gold/min",
      dmg: "Damage/min",
      vision: "Vision/min",
      kp: "Kill part.",
      deaths: "Fewer deaths",
    } satisfies ByMetric<string>,
    metricNames: {
      cs: "farming",
      gold: "gold income",
      dmg: "damage to champions",
      vision: "vision",
      kp: "kill participation",
      deaths: "staying alive",
    } satisfies ByMetric<string>,
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    noStrength: "No clear edge over your lane opponents yet.",
    noWeakness: "No clear weak spot. Nice work!",
    explainUp: {
      cs: (v: string) => `You out-farm your lane opponent by ${v}% on average.`,
      gold: (v: string) => `You earn ${v}% more gold per minute than your lane opponent.`,
      dmg: (v: string) => `You deal ${v}% more damage to champions than your lane opponent.`,
      vision: (v: string) => `Your vision score is ${v}% higher than your lane opponent's.`,
      kp: (v: string) => `You take part in ${v}% more of your team's kills than your opponent does for theirs.`,
      deaths: (v: string) => `You die ${v}% less often than your lane opponent.`,
    } satisfies ByMetric<(v: string) => string>,
    explainDown: {
      cs: (v: string) => `You farm ${v}% less than your lane opponent on average.`,
      gold: (v: string) => `You earn ${v}% less gold per minute than your lane opponent.`,
      dmg: (v: string) => `You deal ${v}% less damage to champions than your lane opponent.`,
      vision: (v: string) => `Your vision score is ${v}% lower than your lane opponent's.`,
      kp: (v: string) => `You take part in ${v}% less of your team's kills than your opponent does for theirs.`,
      deaths: (v: string) => `You die ${v}% more often than your lane opponent.`,
    } satisfies ByMetric<(v: string) => string>,
    howTo: "How to use this",
    tipBuild: (champ: string, lane: string) =>
      `Open ${champ} ${lane} and compare your items and runes with “Top builds right now”.`,
    tipBuildLink: (champ: string) => `${champ} builds`,
    tipMeta: (lane: string) =>
      `Check the Meta Chart for champions rising in ${lane}. They're worth learning before everyone else does.`,
    tipMetaLink: "Meta Chart",
    tipTier: (lane: string) =>
      `Use the Tier List to pick a strong second ${lane} champion, so you have a backup when your main is banned or taken.`,
    tipTierLink: (lane: string) => `${lane} tier list`,
    tipPractice: {
      cs: "Practice focus: last-hitting and wave control. Aim for +1 CS per minute over your next few games.",
      gold: "Practice focus: gold income. Take tower plates and catch side waves between fights.",
      dmg: "Practice focus: damage. Look for more trades in lane and stay in range during teamfights.",
      vision: "Practice focus: vision. Buy a Control Ward every back and use your trinket on cooldown.",
      kp: "Practice focus: joining fights. Move with your team for dragons and skirmishes instead of farming alone.",
      deaths: "Practice focus: dying less. Ward before pushing, track the enemy jungler and back when low.",
    } satisfies ByMetric<string>,
    tipKeepGoing:
      "Practice focus: keep queuing your best champions and review a recent loss to find one thing to fix.",
    // 업데이트 버튼
    update: "Update",
    updating: "Updating…",
    updatedAgo: (ago: string) => `Updated ${ago}`,
    updateWait: (sec: number) => `Try again in ${sec}s`,
    updateFailed: "Couldn't update. Try again in a moment.",
    // 지금 흐름 · 이번 게임 추천
    nowTitle: "Your form & next game",
    flowLabel: "Right now",
    flowWinStreak: (n: number) => `On a ${n}-game win streak. You're playing well.`,
    flowLossStreak: (n: number) => `${n} losses in a row. A short break before the next game can help.`,
    flowRising: (w: number, l: number) => `${w}W ${l}L in your last 5. Trending up.`,
    flowFalling: (w: number, l: number) => `${w}W ${l}L in your last 5. A bit of a dip lately.`,
    flowSteady: (w: number, l: number) => `${w}W ${l}L in your last 5. Steady.`,
    pickLabel: "Try this game",
    pickKeep: (champ: string, lane: string) => `Stay on ${champ} ${lane}. It's working right now.`,
    pickBest: (champ: string, lane: string, wr: string) => `Play ${champ} ${lane}. Your best recent pick (${wr}% wins).`,
    pickMeta: (champ: string, lane: string, wr: string) => `Try ${champ} ${lane}. It's one of the strongest picks this patch (${wr}% wins).`,
    pickBuild: "See build",
    goalLabel: "Focus this game",
    avoidLabel: "Rest for now",
    avoidText: (champ: string, w: number, l: number) => `${champ} (${w}W ${l}L lately)`,
  },
};

export type Dict = typeof en;

const ko: Dict = {
  siteTitle: "livelol.stats - 롤 챔피언 통계",
  siteDescription: "리그 오브 레전드 챔피언 티어, 빌드, 룬, 카운터 통계",
  nav: {
    tier: "티어 리스트",
    trends: "패치 트렌드",
    meta: "메타 차트",
    summoner: "소환사 검색",
    faq: "FAQ",
  },
  footerFeedback: "의견 남기기",
  mockBanner:
    "이 서버는 아직 실제 게임을 모으는 중이라 지금 보이는 승률·픽률·순위는 예시 데이터예요. 게임이 모이면 실제 통계와 빌드로 바뀌어요.",
  server: "서버",
  language: "언어",
  lanes: {
    top: "탑",
    jungle: "정글",
    mid: "미드",
    bottom: "원딜",
    support: "서폿",
  },
  ranks: {
    all: "에메랄드+ 전체",
    emerald: "에메랄드",
    diamond: "다이아몬드",
    master: "마스터+",
  },
  servers: {
    kr: "한국",
    na1: "북미",
    euw1: "유럽 서부",
  },
  emeraldPlus: "에메랄드+",
  tier: (t) => (t === "OP" ? "OP" : `${t}티어`),
  serverName: (s) => `${s} 서버`,
  patch: (p) => `패치 ${p}`,
  games: (n) => `${n}게임`,
  winRate: "승률",
  pickRate: "픽률",
  banRate: "밴율",
  metaScore: "메타 점수",
  rank: "순위",
  champion: "챔피언",
  tierCol: "티어",
  gamesCol: "표본수",
  sampleData: "예시 데이터",
  notEnoughSample: "아직 표본이 부족해요.",
  minutesAgo: (n) => `${n}분 전`,
  hoursAgo: (n) => `${n}시간 전`,
  daysAgo: (n) => `${n}일 전`,
  withinHour: "1시간 이내",
  updated: (ago) => `${ago} 업데이트`,
  notFound: "페이지를 찾을 수 없어요",
  backHome: "홈으로",
  homeSubtitle: (server, patch) =>
    `${server} 서버 · 패치 ${patch} 기준 챔피언 티어, 빌드, 룬, 카운터`,
  bestPicks: (lane) => `${lane} 추천 챔피언`,
  heroTagline: "지금 이기는 픽을 가장 빠르게.",
  heroFeatured: (name, lane) => `지금 가장 좋은 픽 · ${name} ${lane}`,
  bestPicksTitle: "라인별 추천 챔피언",
  viewAll: "전체 보기",
  risingOnPatch: (p) => `패치 ${p} 떠오르는 챔피언`,
  fallingOnPatch: (p) => `패치 ${p} 떨어지는 챔피언`,
  viewAllTrends: "패치 트렌드 전체 보기",
  championSearch: "챔피언 검색",
  hotBuildVideos: "조회수 핫한 템트리",
  hotBuildNote: "요즘 유튜브에서 조회수 높은 롤 빌드 영상이에요. 누르면 바로 재생돼요.",
  views: (n) => `조회수 ${n}회`,
  searchPlaceholder: "챔피언 이름으로 검색 (예: 아리, Ahri)",
  noResults: "검색 결과가 없어요.",
  liveSubtitle: (server, updated) =>
    `${server} 서버${updated ? ` · ${updated}` : ""}`,
  gamesUnit: "판",
  last24h: (server) => `최근 24시간 동안 분석한 ${server} 서버 랭크 게임`,
  gamesByHour: "시간대별 게임 수",
  hourLabel: (h) => `${h}시`,
  hourTitle: (h, n) => `${h}시: ${n}판`,
  gamesByHourKst: "시간대별 게임 수 (한국 시간)",
  activityCollecting:
    "이 서버의 게임을 모으는 중이에요. 수집이 끝나면 최근 24시간 게임 수가 표시돼요.",
  liveUnavailable: "실시간 인원은 아직 준비 중이에요.",
  liveChecking: "지금 게임 중인 인원을 확인하는 중…",
  playersUnit: "명",
  liveHeroTitle: "지금 게임 중인 플레이어",
  liveVsHour: "1시간 전보다",
  liveChampsTitle: "지금 가장 많이 플레이 중인 챔피언",
  liveChampsNote: (games, h) => `최근 ${h}시간 진행 중 랭크 게임 ${games}판의 픽 비율로 나눈 추정치`,
  liveChampsGames: (n) => `${n}판`,
  liveChampsPlayers: "{n}명",
  liveChampsTotal: "지금 게임 중인 {n}명이 하고 있는 챔피언",
  liveChampsSum: "챔피언 {n}개 · 합계 {total}명",
  liveChampsMore: "챔피언 {n}개 모두 보기",
  liveChampsLess: "상위 10개만 보기",
  liveChampsEmpty: "진행 중인 게임을 모으는 중이에요. 몇 분 뒤에 다시 봐 주세요.",
  liveJust: "방금",
  liveNext: (s) => `다음 갱신까지 ${s}초`,
  liveRange: (h) => `최근 ${h}시간`,
  liveNow: "지금",
  liveFromHistory: "마지막으로 기록된 인원이에요.",
  liveCaption: (total) =>
    `지금 게임 중인 마스터 이상 랭커 (추정, 전체 ${total}명 중)`,
  liveAria: "실시간 인원 추이",
  livePointTitle: (time, n) => `${time} 약 ${n}명`,
  liveFoot:
    "지금 숫자는 1분마다, 그래프는 10분마다 기록 · 마스터+ 랭커 표본 조사로 추정",
  tierTitle: "챔피언 티어 리스트",
  soloGames: (n) => `솔로랭크 ${n}게임`,
  trendsTitle: "패치 트렌드",
  scoreChangeDetail: (score, wr) => `메타 점수 ${score}, 승률 ${wr}%`,
  scoreChangeRange: (prev, patch) => `패치 ${prev} → ${patch} 메타 점수 변화`,
  realGames: "실제 게임",
  trendsFirstPatch:
    "실제 데이터는 이번 패치부터 모으기 시작했어요. 다음 패치 데이터가 쌓이면 오르고 내린 챔피언이 여기에 표시돼요.",
  scoreChangeChart: "메타 점수 변화가 큰 챔피언 (▲ 상승 · ▼ 하락)",
  rising: "떠오르는 챔피언",
  falling: "떨어지는 챔피언",
  sparkCaption: (n, a, b) => `그래프: 최근 ${n}개 패치(${a}~${b}) 승률 흐름`,
  noMatches: "해당하는 챔피언이 없어요.",
  champMetaTitle: (name) => `${name} 빌드, 룬, 카운터`,
  sourceReal: " 솔로랭크 실제 게임",
  sourceMock: " · 승률·픽률은 예시 데이터",
  patchTrend: (n) => `패치별 추이 (최근 ${n}개 패치)`,
  laneRank: (lane) => `${lane} 순위`,
  rankSuffix: "위",
  topBuilds: "지금 승률 높은 빌드",
  topBuildsNote: (games, updated) =>
    `최근 수집한 ${games}게임 기준${updated ? ` · ${updated}` : ""} · 많이 쓰인 선택지 중 승률 순 · 게임 수가 적은 선택지는 제외`,
  keystoneSecondary: "핵심 룬 + 보조 룬",
  coreFirstTwo: "코어 아이템 (먼저 완성한 2개)",
  boots: "신발",
  buildTrend: "템트리 승률 추이",
  buildTrendNote: (window, server) =>
    `많이 쓰인 코어템 조합(먼저 완성한 2개)의 날짜별 승률 · ${window}일 이동 평균 · ${server} 서버 에메랄드+ · 표본이 적은 날은 앞뒤 날짜로 이어 그림`,
  recRunes: "추천 룬",
  coreItems: "코어 아이템",
  corePath: "코어템 순서 (1~4코어)",
  coreSlot: (n) => `${n}코어`,
  fullBuilds: "많이 쓰는 코어 빌드 (완성 순서)",
  pickShort: "픽",
  matchupNote: "아직 상대별 게임 수가 적어서, 게임 수도 함께 고려해 순서를 정했어요.",
  startingItems: "시작 아이템",
  summonerSpells: "소환사 주문",
  skillOrder: "스킬 마스터 순서",
  easyMatchups: "상대하기 쉬운 챔피언",
  hardMatchups: "상대하기 어려운 챔피언",
  buildRunesCounters: "빌드 · 룬 · 카운터",
  noBuildLane: (name, lane) =>
    `이번 패치에서 ${name} ${lane} 게임이 아직 충분히 모이지 않았어요. 게임이 더 모이면 실제 빌드가 표시돼요.`,
  noBuildYet:
    "실제 랭크 게임 데이터를 수집하기 시작하면 이곳에 상위 랭커들이 실제로 쓰는 룬, 아이템, 스펠, 스킬 순서, 카운터가 표시돼요.",
  metaTitle: "메타 차트",
  metaSubtitle: (server, window) =>
    `${server} 서버 · 에메랄드+ · 날짜별 픽률 (${window}일 이동 평균)`,
  metaIntro: (window) =>
    `주식 차트처럼 요즘 많이 골라지고 있는 챔피언과 덜 골라지는 챔피언을 보여줘요. 최근 ${window}일 픽률을 그 전 ${window}일과 비교했어요.`,
  metaCollecting:
    "이 서버의 날짜별 기록을 모으는 중이에요. 다음 수집(6시간마다)이 끝나면 차트가 표시돼요.",
  pickRising: "▲ 픽률 상승",
  pickFalling: "▼ 픽률 하락",
  noNotableChange: "아직 눈에 띄는 변화가 없어요.",
  metaCardTitle: (name, rate, window, games) =>
    `${name} 픽률 ${rate}% (최근 ${window}일 ${games}게임)`,
  summoner: {
    title: "소환사 검색",
    metaTitle: (id) => `${id} - 소환사 분석`,
    intro:
      "Riot ID를 입력하면 최근 솔로랭크 승률, 잘 맞는 챔피언, 강점과 보완할 점을 정리해 드려요.",
    inputLabel: "Riot ID",
    placeholder: "예: Hide on bush#KR1",
    search: "검색",
    searching: (server) =>
      `${server} 서버에서 찾아요. 서버는 오른쪽 위에서 바꿀 수 있어요.`,
    tagHint: (tag) =>
      `# 뒤의 태그까지 입력해 주세요 (예: Hide on bush#KR1). 태그를 빼면 #${tag}로 찾아요.`,
    defaultedTag: (tag) => `태그가 없어서 #${tag}로 찾아봤어요.`,
    notFound: (id, server) =>
      `${server} 서버에서 ${id}을(를) 찾지 못했어요. 철자와 # 뒤 태그를 확인하거나 오른쪽 위에서 서버를 바꿔 보세요.`,
    rateLimited: "지금 검색이 너무 많아요. 1분 뒤에 다시 시도해 주세요.",
    unavailable: "지금은 소환사 검색을 이용할 수 없어요.",
    error: "Riot 서버와 연결이 잘 안 되고 있어요. 잠시 뒤 다시 시도해 주세요.",
    noGames: "최근 솔로랭크 게임 기록이 없어요.",
    level: (n) => `레벨 ${n}`,
    soloDuo: "솔로랭크",
    unranked: "언랭크",
    lp: (n) => `${n} LP`,
    record: (w, l) => `${w}승 ${l}패`,
    tiers: {
      IRON: "아이언",
      BRONZE: "브론즈",
      SILVER: "실버",
      GOLD: "골드",
      PLATINUM: "플래티넘",
      EMERALD: "에메랄드",
      DIAMOND: "다이아몬드",
      MASTER: "마스터",
      GRANDMASTER: "그랜드마스터",
      CHALLENGER: "챌린저",
    },
    analyzed: (n, total) =>
      n === total
        ? `최근 솔로랭크 ${n}게임을 분석했어요`
        : `최근 솔로랭크 ${total}게임 중 ${n}게임을 분석했어요 (나머지는 불러오지 못했어요)`,
    summary: "한눈에 보기",
    sumRole: (lane, n, total) => `주로 ${lane} 포지션을 해요 (${total}게임 중 ${n}게임).`,
    sumBest: (list) => `지금 돌리기 좋은 챔피언: ${list}.`,
    sumBestNone: "한 챔피언을 3게임 이상 하면 잘 맞는 챔피언을 알려 드려요.",
    sumAvoid: (list) => `${list}은(는) 승률이 45% 아래라 잠시 쉬어 가는 걸 추천해요.`,
    sumStrength: (label, v) => `가장 큰 강점: ${label} (맞라이너보다 ▲${v}%).`,
    sumWeakness: (label, v) => `가장 아쉬운 점: ${label} (맞라이너보다 ▼${v}%).`,
    sumForm: (w, l, wr, streak) => `최근 흐름: ${w}승 ${l}패 (승률 ${wr}%)${streak}.`,
    sumStreak: (win, n) => (n >= 2 ? `, 지금 ${n}${win ? "연승" : "연패"} 중이에요` : ""),
    champRecord: (name, w, l, wr) => `${name} (${w}승 ${l}패, ${wr}%)`,
    form: "최근 흐름",
    formNote:
      "Riot API는 LP 기록을 주지 않아서 티어 그래프 대신 승패 흐름을 보여드려요. 이기면 한 칸 오르고, 지면 한 칸 내려가요.",
    formAria: (w, l) => `최근 게임 승패 흐름: ${w}승 ${l}패`,
    oldest: "이전",
    latest: "최근",
    recentWinRate: "최근 승률",
    currentStreak: "연승/연패",
    streak: (win, n) => `${n}${win ? "연승" : "연패"}`,
    net: "승-패",
    winShort: "승",
    lossShort: "패",
    gameTitle: (champ, win, kda) => `${win ? "승리" : "패배"} · ${champ} · ${kda}`,
    gameCount: (n) => `${n}게임`,
    mostPlayed: "많이 한 챔피언",
    games: "게임",
    kda: "KDA",
    csMin: "분당 CS",
    lane: "라인",
    siteAvg: "사이트 평균",
    siteAvgVal: (v) => `평균 ${v}%`,
    siteAvgNote: (server, patch) =>
      `사이트 평균 = 패치 ${patch} ${server} 서버 에메랄드+ 해당 챔피언·라인 승률이에요.`,
    noSiteAvg: "이 서버의 사이트 평균은 게임이 충분히 모이면 표시돼요.",
    roles: "포지션 분포",
    laneVs: "강점과 약점",
    laneVsCaption: (n) => `같은 포지션 상대와 비교, ${n}게임 평균 (▲ 더 좋음 · ▼ 더 낮음)`,
    noLaneVs: "맞라이너를 비교할 수 있는 게임이 아직 부족해요.",
    metrics: {
      cs: "분당 CS",
      gold: "분당 골드",
      dmg: "분당 피해량",
      vision: "분당 시야",
      kp: "킬 관여율",
      deaths: "적은 데스",
    },
    metricNames: {
      cs: "CS 수급",
      gold: "골드 수급",
      dmg: "챔피언 피해량",
      vision: "시야 장악",
      kp: "킬 관여",
      deaths: "생존력",
    },
    strengths: "강점",
    weaknesses: "약점",
    noStrength: "아직 맞라이너보다 확실히 앞서는 부분은 없어요.",
    noWeakness: "눈에 띄는 약점이 없어요. 잘하고 있어요!",
    explainUp: {
      cs: (v) => `맞라이너보다 CS를 평균 ${v}% 더 먹어요.`,
      gold: (v) => `맞라이너보다 분당 골드를 ${v}% 더 벌어요.`,
      dmg: (v) => `맞라이너보다 챔피언에게 피해를 ${v}% 더 넣어요.`,
      vision: (v) => `맞라이너보다 시야 점수가 ${v}% 높아요.`,
      kp: (v) => `맞라이너보다 팀 킬에 ${v}% 더 많이 관여해요.`,
      deaths: (v) => `맞라이너보다 ${v}% 덜 죽어요.`,
    },
    explainDown: {
      cs: (v) => `맞라이너보다 CS를 평균 ${v}% 덜 먹어요.`,
      gold: (v) => `맞라이너보다 분당 골드가 ${v}% 적어요.`,
      dmg: (v) => `맞라이너보다 챔피언 피해량이 ${v}% 적어요.`,
      vision: (v) => `맞라이너보다 시야 점수가 ${v}% 낮아요.`,
      kp: (v) => `맞라이너보다 팀 킬 관여가 ${v}% 적어요.`,
      deaths: (v) => `맞라이너보다 ${v}% 더 자주 죽어요.`,
    },
    howTo: "이렇게 활용해 보세요",
    tipBuild: (champ, lane) =>
      `${champ} ${lane} 페이지에서 내 아이템·룬을 “지금 승률 높은 빌드”와 비교해 보세요.`,
    tipBuildLink: (champ) => `${champ} 빌드 보기`,
    tipMeta: (lane) =>
      `메타 차트에서 ${lane} 포지션에서 떠오르는 챔피언을 확인해 보세요. 남들보다 먼저 연습해 두면 좋아요.`,
    tipMetaLink: "메타 차트",
    tipTier: (lane) =>
      `티어 리스트에서 강한 ${lane} 챔피언을 하나 더 골라 두면, 주력 챔피언이 밴되거나 뺏겨도 든든해요.`,
    tipTierLink: (lane) => `${lane} 티어 리스트`,
    tipPractice: {
      cs: "연습 포인트: 막타와 라인 관리. 다음 몇 게임은 분당 CS를 1개 더 먹는 걸 목표로 해 보세요.",
      gold: "연습 포인트: 골드 수급. 포탑 방패를 챙기고 싸움 사이사이 사이드 라인을 먹어 주세요.",
      dmg: "연습 포인트: 딜량. 라인전에서 견제를 더 자주 하고 한타 때 사거리 안에 머물러 보세요.",
      vision: "연습 포인트: 시야. 귀환할 때마다 제어 와드를 사고 장신구는 쿨마다 써 주세요.",
      kp: "연습 포인트: 합류. 싸움이 열리면 혼자 파밍하지 말고 드래곤·교전에 같이 움직여 보세요.",
      deaths: "연습 포인트: 덜 죽기. 밀기 전에 와드를 박고, 상대 정글 위치를 생각하고, 체력이 낮으면 귀환해요.",
    },
    tipKeepGoing:
      "연습 포인트: 잘 맞는 챔피언을 계속 돌리면서, 최근 진 게임 하나를 돌려 보고 고칠 점 하나만 찾아보세요.",
    update: "업데이트",
    updating: "업데이트 중…",
    updatedAgo: (ago) => `${ago} 업데이트`,
    updateWait: (sec) => `${sec}초 뒤에 다시 할 수 있어요`,
    updateFailed: "업데이트하지 못했어요. 잠시 후 다시 눌러 주세요.",
    nowTitle: "지금 흐름 · 이번 게임 추천",
    flowLabel: "지금 흐름",
    flowWinStreak: (n) => `${n}연승 중이에요. 흐름이 아주 좋아요!`,
    flowLossStreak: (n) => `${n}연패 중이에요. 다음 판 전에 잠깐 쉬어 가는 것도 좋아요.`,
    flowRising: (w, l) => `최근 5판 ${w}승 ${l}패. 올라가는 중이에요.`,
    flowFalling: (w, l) => `최근 5판 ${w}승 ${l}패. 요즘 조금 주춤해요.`,
    flowSteady: (w, l) => `최근 5판 ${w}승 ${l}패. 꾸준해요.`,
    pickLabel: "이번 판 추천",
    pickKeep: (champ, lane) => `지금 잘 되는 ${champ} ${lane} 그대로 가세요.`,
    pickBest: (champ, lane, wr) => `${champ} ${lane}로 가세요. 최근 가장 잘 맞는 챔피언이에요 (승률 ${wr}%).`,
    pickMeta: (champ, lane, wr) => `${champ} ${lane}를 시도해 보세요. 이번 패치 가장 강한 챔피언 중 하나예요 (승률 ${wr}%).`,
    pickBuild: "빌드 보기",
    goalLabel: "이번 판 목표",
    avoidLabel: "잠시 쉬어 갈 챔피언",
    avoidText: (champ, w, l) => `${champ} (최근 ${w}승 ${l}패)`,
  },
};

export const dict = (lang: Lang): Dict => (lang === "ko" ? ko : en);

// "3h ago" / "3시간 전" 같은 상대 시간
export function timeAgo(iso: string, lang: Lang, opts: { minutes?: boolean } = {}) {
  const t = dict(lang);
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (opts.minutes && m < 60) return t.minutesAgo(Math.max(1, m));
  if (h < 1) return t.withinHour;
  return h < 24 ? t.hoursAgo(h) : t.daysAgo(Math.floor(h / 24));
}
