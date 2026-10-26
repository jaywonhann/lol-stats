// 소환사 검색용 Riot API 호출 (계정 → 랭크/프로필 → 최근 솔로랭크 20게임).
// 개발 키는 지역당 2분에 100회라 백그라운드 수집기와 나눠 씁니다. 한 번 검색에 최대 24회만 부르고,
// 결과는 Next 데이터 캐시에 넣어 같은 검색을 반복해도 다시 부르지 않습니다.
// 로컬 테스트: RIOT_API_BASE=http://localhost:8903 이면 {RIOT_API_BASE}/{kr|asia|...}/... 로 보냅니다.
import type { Server } from "./lanes";

export type Region = "asia" | "americas" | "europe";

export const REGION: Record<Server, Region> = {
  kr: "asia",
  na1: "americas",
  euw1: "europe",
};

// 태그 없이 이름만 입력하면 이 태그로 찾아봅니다
export const DEFAULT_TAG: Record<Server, string> = {
  kr: "KR1",
  na1: "NA1",
  euw1: "EUW",
};

export type LookupError = "not-found" | "rate-limited" | "unavailable" | "error";

export class RiotError extends Error {
  constructor(public kind: LookupError) {
    super(kind);
  }
}

const key = () =>
  process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/gi)?.at(-1) ??
  (process.env.RIOT_API_KEY?.trim() || undefined);

const url = (host: Server | Region, path: string) => {
  const base = process.env.RIOT_API_BASE?.replace(/\/+$/, "");
  return base ? `${base}/${host}${path}` : `https://${host}.api.riotgames.com${path}`;
};

const MINUTE = 60;
// 계정·랭크·최근 게임 목록은 10분, 끝난 게임 상세는 바뀌지 않으니 오래 캐시
const SHORT = 10 * MINUTE;
const LONG = 30 * 24 * 60 * MINUTE;

async function get<T>(host: Server | Region, path: string, revalidate = SHORT, tags?: string[]): Promise<T> {
  const k = key();
  if (!k) throw new RiotError("unavailable");
  let res: Response;
  try {
    res = await fetch(url(host, path), {
      headers: { "X-Riot-Token": k },
      next: { revalidate, tags },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RiotError("error");
  }
  if (res.ok) return (await res.json()) as T;
  // 응답 본문은 읽지 않고 상태 코드로만 구분합니다 (키나 원문 오류를 화면에 노출하지 않음)
  if (res.status === 404) throw new RiotError("not-found");
  if (res.status === 429) throw new RiotError("rate-limited");
  if (res.status === 401 || res.status === 403) throw new RiotError("unavailable");
  throw new RiotError("error");
}

export type Account = { puuid: string; gameName: string; tagLine: string };

export type LeagueEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export type SummonerProfile = { profileIconId: number; summonerLevel: number };

export type Participant = {
  puuid: string;
  teamId: number;
  teamPosition: string;
  championId: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  gameEndedInEarlySurrender?: boolean;
  riotIdGameName?: string;
  riotIdTagline?: string;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
};

export type Match = {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number; // 초
    gameEndTimestamp?: number;
    gameVersion: string;
    queueId: number;
    participants: Participant[];
  };
};

export type Timeline = {
  info: {
    participants: { participantId: number; puuid: string }[];
    frames: {
      participantFrames: Record<string, { totalGold: number; minionsKilled: number; jungleMinionsKilled: number }>;
    }[];
  };
};

export type Mastery = { championId: number; championLevel: number; championPoints: number; lastPlayTime?: number };

export type Lookup = {
  mastery: Mastery[];
  timelines: Record<string, Timeline>; // 최근 일부 게임만 (실패하면 비어 있음)
  account: Account;
  profile: SummonerProfile | null;
  solo: LeagueEntry | null;
  matchIds: number;
  matches: Match[]; // 받아온 것만 (최신 → 오래된 순)
};

// 동시에 최대 limit개씩만 요청
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// 업데이트 버튼이 이 태그로 캐시를 비웁니다 (summoner-cache.ts)
export const summonerTag = (server: Server, gameName: string, tagLine: string) =>
  `sum:${server}:${encodeURIComponent(`${gameName}#${tagLine}`.toLowerCase())}`;

export async function lookupSummoner(
  server: Server,
  gameName: string,
  tagLine: string,
  count = 20,
): Promise<Lookup> {
  const region = REGION[server];
  const tags = [summonerTag(server, gameName, tagLine)];
  const account = await get<Account>(
    region,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    SHORT,
    tags,
  );
  const puuid = encodeURIComponent(account.puuid);
  // 랭크·프로필은 없어도 분석은 할 수 있으니 실패해도 넘어갑니다. 키 거부/요청 한도는 그대로 알립니다.
  const soft = <T>(p: Promise<T>) =>
    p.catch((e) => {
      if (e instanceof RiotError && e.kind !== "not-found" && e.kind !== "error") throw e;
      return null;
    });
  const [entries, profile, ids, mastery] = await Promise.all([
    soft(get<LeagueEntry[]>(server, `/lol/league/v4/entries/by-puuid/${puuid}`, SHORT, tags)),
    soft(get<SummonerProfile>(server, `/lol/summoner/v4/summoners/by-puuid/${puuid}`, SHORT, tags)),
    get<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`, SHORT, tags),
    soft(get<Mastery[]>(server, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=5`, SHORT, tags)),
  ]);
  const matches = await pool(ids.slice(0, count), 5, (id) =>
    get<Match>(region, `/lol/match/v5/matches/${encodeURIComponent(id)}`, LONG).catch(() => null),
  );
  // 라인전 수치용 타임라인은 최근 10게임만 (호출 수를 아끼려고), 실패해도 무시
  const recent = matches.filter((m): m is Match => m !== null).slice(0, 10);
  const tl = await pool(recent, 5, (m) =>
    get<Timeline>(region, `/lol/match/v5/matches/${encodeURIComponent(m.metadata.matchId)}/timeline`, LONG).catch(() => null),
  );
  const timelines: Record<string, Timeline> = {};
  recent.forEach((m, i) => {
    if (tl[i]) timelines[m.metadata.matchId] = tl[i]!;
  });
  return {
    mastery: mastery ?? [],
    timelines,
    account,
    profile,
    solo: entries?.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null,
    matchIds: ids.length,
    matches: matches.filter((m): m is Match => m !== null),
  };
}

// "Name#TAG" → 이름/태그. 태그가 없으면 서버 기본 태그를 씁니다.
export function parseRiotId(raw: string, server: Server) {
  const s = raw.trim().replace(/\s+/g, " ");
  const i = s.lastIndexOf("#");
  const gameName = (i >= 0 ? s.slice(0, i) : s).trim();
  const tag = i >= 0 ? s.slice(i + 1).trim() : "";
  if (!gameName) return null;
  return {
    gameName,
    tagLine: tag || DEFAULT_TAG[server],
    defaultedTag: !tag,
  };
}

export type LadderEntry = { puuid?: string; leaguePoints: number; wins: number; losses: number; hotStreak?: boolean };
export type LadderTier = "challenger" | "grandmaster" | "master";

// 상위 래더(챌린저/그랜드마스터/마스터). 목록은 10분, 이름(계정)은 하루 캐시
export async function ladder(server: Server, tier: LadderTier, top = 30) {
  const data = await get<{ entries: LadderEntry[] }>(server, `/lol/league/v4/${tier}leagues/by-queue/RANKED_SOLO_5x5`);
  const sorted = [...data.entries].sort((a, b) => b.leaguePoints - a.leaguePoints);
  const names = await pool(sorted.slice(0, top), 4, (e) =>
    e.puuid
      ? get<Account>(REGION[server], `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(e.puuid)}`, 24 * 60 * MINUTE).catch(() => null)
      : Promise.resolve(null),
  );
  return {
    total: sorted.length,
    rows: sorted.slice(0, top).map((e, i) => ({ ...e, rank: i + 1, account: names[i] })),
  };
}
