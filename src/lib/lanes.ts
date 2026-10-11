export const LANES = [
  { id: "top", label: "탑" },
  { id: "jungle", label: "정글" },
  { id: "mid", label: "미드" },
  { id: "bottom", label: "원딜" },
  { id: "support", label: "서폿" },
] as const;

export type Lane = (typeof LANES)[number]["id"];

export const RANKS = [
  { id: "emerald", label: "에메랄드+" },
  { id: "diamond", label: "다이아+" },
  { id: "master", label: "마스터+" },
  { id: "all", label: "전체" },
] as const;

export type Rank = (typeof RANKS)[number]["id"];

export const laneLabel = (lane: Lane) => LANES.find((l) => l.id === lane)!.label;

export const parseLane = (v: string | undefined): Lane =>
  LANES.some((l) => l.id === v) ? (v as Lane) : "top";

export const parseRank = (v: string | undefined): Rank =>
  RANKS.some((r) => r.id === v) ? (v as Rank) : "emerald";
