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
