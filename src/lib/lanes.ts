import { dict, type Lang } from "./i18n";

// 화면에 보이는 이름은 i18n 사전(dict)에서 가져옵니다
export const LANES = [
  { id: "top" },
  { id: "jungle" },
  { id: "mid" },
  { id: "bottom" },
  { id: "support" },
] as const;

export type Lane = (typeof LANES)[number]["id"];

export const RANKS = [
  { id: "all" },
  { id: "emerald" },
  { id: "diamond" },
  { id: "master" },
] as const;

export type Rank = (typeof RANKS)[number]["id"];

export const laneLabel = (lane: Lane, lang: Lang) => dict(lang).lanes[lane];

export const parseLane = (v: string | undefined): Lane =>
  LANES.some((l) => l.id === v) ? (v as Lane) : "top";

export const parseRank = (v: string | undefined): Rank =>
  RANKS.some((r) => r.id === v) ? (v as Rank) : "all";

export const rankLabel = (rank: Rank, lang: Lang) => dict(lang).ranks[rank];

export const SERVERS = [{ id: "kr" }, { id: "na1" }, { id: "euw1" }] as const;

export type Server = (typeof SERVERS)[number]["id"];

export const parseServer = (v: string | undefined): Server =>
  SERVERS.some((s) => s.id === v) ? (v as Server) : "kr";

export const serverLabel = (server: Server, lang: Lang) =>
  dict(lang).servers[server];

export type Filter = { server: Server; rank: Rank };

// Riot은 2025년부터 패치를 연도로 불러요 (게임 데이터의 16.22 = 공식 이름 26.22).
// 유저와 유튜버가 검색하는 이름과 맞도록 화면·검색 제목에는 공식 이름을 써요. 주소와 데이터 키는 그대로예요.
export const patchName = (p: string | null | undefined): string => {
  const m = /^(\d+)\.(\d+)$/.exec(p ?? "");
  if (!m) return p ?? "";
  const major = Number(m[1]);
  return major >= 15 && major < 25 ? `${major + 10}.${Number(m[2])}` : (p as string);
};
