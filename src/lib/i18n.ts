// 화면 문구 사전 (영어 기본, 한국어). 클라이언트 컴포넌트에서도 쓰므로 next/headers를 가져오지 않습니다.
import type { Lane, Rank, Server } from "./lanes";

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
  nav: { tier: "Tier List", trends: "Patch Trends", meta: "Meta Chart" },
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
  viewAll: "View all",
  risingOnPatch: (p: string) => `Rising on patch ${p}`,
  fallingOnPatch: (p: string) => `Falling on patch ${p}`,
  viewAllTrends: "View all patch trends",
  championSearch: "Champion search",
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
  liveCaption: (total: string) =>
    `Master+ players in game now (estimate, of ${total})`,
  liveAria: "Live player count trend",
  livePointTitle: (time: string, n: number) => `${time} ~${n} players`,
  liveFoot:
    "Updates every 2 min · trend while this page is open · samples 20 Master+ players at a time",
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
    `Daily win rate of popular core item pairs (first 2 completed) · ${window}-day moving average · ${server} Emerald+ · days with few games left blank`,
  recRunes: "Recommended runes",
  coreItems: "Core items",
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
};

export type Dict = typeof en;

const ko: Dict = {
  siteTitle: "livelol.stats - 롤 챔피언 통계",
  siteDescription: "리그 오브 레전드 챔피언 티어, 빌드, 룬, 카운터 통계",
  nav: { tier: "티어 리스트", trends: "패치 트렌드", meta: "메타 차트" },
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
  viewAll: "전체 보기",
  risingOnPatch: (p) => `패치 ${p} 떠오르는 챔피언`,
  fallingOnPatch: (p) => `패치 ${p} 떨어지는 챔피언`,
  viewAllTrends: "패치 트렌드 전체 보기",
  championSearch: "챔피언 검색",
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
  liveCaption: (total) =>
    `지금 게임 중인 마스터 이상 랭커 (추정, 전체 ${total}명 중)`,
  liveAria: "실시간 인원 추이",
  livePointTitle: (time, n) => `${time} 약 ${n}명`,
  liveFoot:
    "2분마다 갱신 · 이 페이지를 열어 둔 동안의 흐름 · 마스터+ 랭커 20명씩 표본 조사",
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
    `많이 쓰인 코어템 조합(먼저 완성한 2개)의 날짜별 승률 · ${window}일 이동 평균 · ${server} 서버 에메랄드+ · 표본이 적은 날은 비워 둠`,
  recRunes: "추천 룬",
  coreItems: "코어 아이템",
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
