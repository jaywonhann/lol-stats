// 소환사 검색용 Riot API 호출 (계정 → 랭크/프로필 → 최근 솔로랭크 20게임).
// 개발 키는 지역당 2분에 100회라 백그라운드 수집기와 나눠 씁니다. 한 번 검색에 최대 24회만 부르고,
// 결과는 Next 데이터 캐시에 넣어 같은 검색을 반복해도 다시 부르지 않습니다.
// 로컬 테스트: RIOT_API_BASE=http://localhost:8903 이면 {RIOT_API_BASE}/{kr|asia|...}/... 로 보냅니다.
import { unstable_cache } from "next/cache";
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

async function get<T>(host: Server | Region, path: string, revalidate: number | false = SHORT, tags?: string[], retry = 1): Promise<T> {
  const k = key();
  if (!k) throw new RiotError("unavailable");
  let res: Response;
  try {
    res = await fetch(url(host, path), {
      headers: { "X-Riot-Token": k },
      ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate, tags } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RiotError("error");
  }
  if (res.ok) return (await res.json()) as T;
  // 같은 키를 쓰는 수집기(GitHub Actions)와 겹치면 잠깐 429가 와요. 예전엔 그 판이 그냥 빠지거나 "요청 한도" 화면이 떴어요.
  // Riot이 알려 주는 대기 시간이 2초 이하면 한 번만 기다렸다가 다시 받아요.
  if (res.status === 429 && retry > 0) {
    const wait = Number(res.headers.get("retry-after") ?? "1");
    if (Number.isFinite(wait) && wait <= 2) {
      await new Promise((r) => setTimeout(r, Math.max(300, wait * 1000)));
      return get<T>(host, path, revalidate, tags, retry - 1);
    }
  }
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
  champLevel?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  perks?: { styles: { style: number; selections: { perk: number }[] }[] };
  // 업적 배지용 (Riot 경기 기록에 원래 있는 값들)
  pentaKills?: number;
  quadraKills?: number;
  largestKillingSpree?: number;
  firstBloodKill?: boolean;
  challenges?: { soloKills?: number; teamDamagePercentage?: number };
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

// 타임라인 원본은 게임 하나에 1~3MB라 Next의 데이터 캐시(한 항목 2MB까지)에 안 들어가서, 전적을 열 때마다 다시 받았어요.
// 라인전 비교에 쓰는 15분까지의 골드·CS만 남겨 작게 저장해요 (끝난 게임은 안 바뀌니 오래 보관). 실패는 저장하지 않아요.
const slimTimeline = (region: Region, matchId: string) =>
  unstable_cache(
    async (): Promise<Timeline> => {
      const t = await get<Timeline>(region, `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`, false);
      return {
        info: {
          participants: t.info.participants.map((p) => ({ participantId: p.participantId, puuid: p.puuid })),
          frames: t.info.frames.slice(0, 16).map((f) => ({
            participantFrames: Object.fromEntries(
              Object.entries(f.participantFrames).map(([k, v]) => [k, { totalGold: v.totalGold, minionsKilled: v.minionsKilled, jungleMinionsKilled: v.jungleMinionsKilled }]),
            ),
          })),
        },
      };
    },
    ["tl-slim", matchId],
    { revalidate: LONG },
  )();

// 업데이트 버튼이 이 태그로 캐시를 비웁니다 (summoner-cache.ts)
export const summonerTag = (server: Server, gameName: string, tagLine: string) =>
  `sum:${server}:${encodeURIComponent(`${gameName}#${tagLine}`.toLowerCase())}`;

export async function lookupSummoner(
  server: Server,
  gameName: string,
  tagLine: string,
  count = 20,
  withTimelines = false,
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
  // 게임 상세를 동시에 10개씩 받아요 (Riot 키 한도: 1초에 20번). 서버(미국)에서 아시아 Riot 서버까지 한 번에 0.5초쯤이라
  // 6개씩일 때는 20판에 4번을 기다려서 처음 찾는 소환사가 6초 걸렸어요. 실패한 건 건너뛰어요.
  // 타임라인(라인전 수치용)은 한 판에 1~3MB라 무료 서버에서 읽는 데만 몇 초가 걸려요. 그래서 전적 화면은
  // 타임라인 없이 먼저 보여 주고, 라인전 수치는 matchTimelines()로 뒤따라 받아요 (withTimelines=false가 기본).
  const list = ids.slice(0, count);
  const jobs: (() => Promise<Match | Timeline | null>)[] = [
    ...list.map((id) => () => get<Match>(region, `/lol/match/v5/matches/${encodeURIComponent(id)}`, LONG).catch(() => null)),
    ...(withTimelines ? list.slice(0, 10) : []).map((id) => () => slimTimeline(region, id).catch(() => null)),
  ];
  const done = await pool(jobs, 10, (job) => job());
  const matches = done.slice(0, list.length) as (Match | null)[];
  const timelines: Record<string, Timeline> = {};
  (withTimelines ? list.slice(0, 10) : []).forEach((id, i) => {
    const t = done[list.length + i] as Timeline | null;
    if (t && matches[i]) timelines[id] = t;
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

// 전적 화면용: 최근 10판이 오면 바로 화면을 띄우고(quick), 20판이 다 오면 전체 분석(full)으로 바꿔요.
// 20판을 한꺼번에 기다리면 Riot 대기가 0.5~1초 더 걸려서 첫 화면이 늦었어요. 요청 수와 동시 개수(10)는 그대로예요.
export async function lookupSplit(
  server: Server,
  gameName: string,
  tagLine: string,
  count = 20,
  first = 10,
): Promise<{ quick: Lookup; full: Promise<Lookup> }> {
  const region = REGION[server];
  const tags = [summonerTag(server, gameName, tagLine)];
  const account = await get<Account>(
    region,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    SHORT,
    tags,
  );
  const puuid = encodeURIComponent(account.puuid);
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
  const list = ids.slice(0, count);
  // 일꾼 10개가 순서대로 받아요. 판마다 따로 끝나는 걸 알 수 있게 약속(promise)을 하나씩 만들어요.
  const slots = list.map(() => {
    let done!: (m: Match | null) => void;
    const p = new Promise<Match | null>((r) => (done = r));
    return { p, done };
  });
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      slots[i].done(await get<Match>(region, `/lol/match/v5/matches/${encodeURIComponent(list[i])}`, LONG).catch(() => null));
    }
  };
  for (let k = 0; k < Math.min(10, list.length); k++) void worker();
  const base = {
    mastery: mastery ?? [],
    timelines: {},
    account,
    profile,
    solo: entries?.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null,
    matchIds: ids.length,
  };
  const keep = (ms: (Match | null)[]) => ms.filter((m): m is Match => m !== null);
  const head = await Promise.all(slots.slice(0, first).map((s) => s.p));
  const full = Promise.all(slots.map((s) => s.p)).then((ms) => ({ ...base, matches: keep(ms) }));
  return { quick: { ...base, matches: keep(head) }, full };
}

// "Name#TAG" → 이름/태그. 태그가 없으면 서버 기본 태그를 씁니다.
// 라인전 수치(10분 CS·15분 골드 차이)용 타임라인. 전적 화면이 먼저 뜬 뒤 따로 받아요.
export async function matchTimelines(server: Server, matchIds: string[]): Promise<Record<string, Timeline>> {
  const region = REGION[server];
  const got = await pool(matchIds, 4, (id) => slimTimeline(region, id).catch(() => null));
  const out: Record<string, Timeline> = {};
  matchIds.forEach((id, i) => {
    const t = got[i];
    if (t) out[id] = t;
  });
  return out;
}

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

// 지금 하고 있는 게임 (op.gg "인게임 정보"). 게임 중이 아니면 null, 확인하지 못했으면(요청 한도·시간 초과) "retry". 1분만 캐시해요.
export type ActiveGame = {
  gameLength: number; // 초
  gameStartTime: number;
  gameQueueConfigId: number;
  participants: { puuid: string; teamId: number; championId: number; spell1Id: number; spell2Id: number; riotId?: string }[];
  bannedChampions?: { championId: number; teamId: number }[];
};
export async function activeGame(server: Server, puuid: string, tags?: string[]): Promise<ActiveGame | null | "retry"> {
  try {
    return await get<ActiveGame>(server, `/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`, MINUTE, tags);
  } catch (e) {
    // 404는 지금 게임 중이 아니라는 뜻. 그 밖의 실패는 잠시 뒤 다시 확인해요
    return e instanceof RiotError && (e.kind === "not-found" || e.kind === "unavailable") ? null : "retry";
  }
}

// 인게임 칸에 쓰는 솔로랭크 티어 (없거나 실패하면 null)
export async function soloEntry(server: Server, puuid: string): Promise<LeagueEntry | null> {
  try {
    const list = await get<LeagueEntry[]>(server, `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`, SHORT);
    return list.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null;
  } catch {
    return null;
  }
}

// 멀티서치용 가벼운 조회: 계정·솔로랭크·최근 솔로랭크 몇 게임만 (타임라인·숙련도 없이 호출 수를 아껴요)
export async function lookupLite(server: Server, gameName: string, tagLine: string, count = 8) {
  const region = REGION[server];
  const tags = [summonerTag(server, gameName, tagLine)];
  const account = await get<Account>(
    region,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    SHORT,
    tags,
  );
  const puuid = encodeURIComponent(account.puuid);
  const [entries, ids] = await Promise.all([
    get<LeagueEntry[]>(server, `/lol/league/v4/entries/by-puuid/${puuid}`, SHORT, tags).catch((e) => {
      if (e instanceof RiotError && (e.kind === "rate-limited" || e.kind === "unavailable")) throw e;
      return null;
    }),
    get<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`, SHORT, tags),
  ]);
  const matches = await pool(ids, 3, (id) =>
    get<Match>(region, `/lol/match/v5/matches/${encodeURIComponent(id)}`, LONG).catch(() => null),
  );
  return {
    account,
    solo: entries?.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null,
    matches: matches.filter((m): m is Match => m !== null),
  };
}
