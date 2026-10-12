export const LANES = [
  { id: "top", label: "탑" },
  { id: "jungle", label: "정글" },
  { id: "mid", label: "미드" },
  { id: "bottom", label: "원딜" },
  { id: "support", label: "서폿" },
] as const;

export type Lane = (typeof LANES)[number]["id"];

export const RANKS = [
  { id: "all", label: "에메랄드+ 전체" },
  { id: "emerald", label: "에메랄드" },
  { id: "diamond", label: "다이아몬드" },
  { id: "master", label: "마스터+" },
] as const;

export type Rank = (typeof RANKS)[number]["id"];

export const laneLabel = (lane: Lane) =>
  LANES.find((l) => l.id === lane)!.label;

export const parseLane = (v: string | undefined): Lane =>
  LANES.some((l) => l.id === v) ? (v as Lane) : "top";

export const parseRank = (v: string | undefined): Rank =>
  RANKS.some((r) => r.id === v) ? (v as Rank) : "all";

export const rankLabel = (rank: Rank) =>
  RANKS.find((r) => r.id === rank)!.label;

export const SERVERS = [
  { id: "kr", label: "한국" },
  { id: "na1", label: "북미" },
  { id: "euw1", label: "유럽 서부" },
] as const;

export type Server = (typeof SERVERS)[number]["id"];

export const parseServer = (v: string | undefined): Server =>
  SERVERS.some((s) => s.id === v) ? (v as Server) : "kr";

export const serverLabel = (server: Server) =>
  SERVERS.find((s) => s.id === server)!.label;

export type Filter = { server: Server; rank: Rank };
