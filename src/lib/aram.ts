// 증바람·칼바람 집계 (scripts/aram.mjs 가 data/aram/{server}/{patch}.json 에 저장)
import fs from "node:fs";
import path from "node:path";

type Counts = Record<string, [number, number]>;
export type AramMode = "mayhem" | "aram";
export const ARAM_MODES: AramMode[] = ["mayhem", "aram"];
// 모드를 안 고르면 증바람 데이터가 있을 때만 증바람, 아니면 칼바람 (증바람은 기간 한정 모드라 없을 때가 있어요)
export const parseMode = (m?: string, hasMayhem = true): AramMode => (m === "aram" ? "aram" : m === "mayhem" ? "mayhem" : hasMayhem ? "mayhem" : "aram");

export type AramChamp = {
  games: number;
  wins: number;
  items: Counts;
  builds: Counts;
  boots: Counts;
  augments: Counts;
  augSets: Counts;
  spells: Counts;
  runes: Counts;
  with?: Counts; // 같은 팀 챔피언 key
  vs?: Counts; // 상대 팀 챔피언 key
};
type AramFile = { patch: string; updatedAt: string; matches: Record<string, number>; champs: Record<string, AramChamp> };
export type AugmentMeta = { en?: string; ko?: string; icon?: string | null; rarity?: number | string };

const ROOT = path.join(process.cwd(), "data", "aram");
const SERVERS = ["kr", "na1", "euw1"];
export const MIN_ARAM_GAMES = 15;

const add = (into: Counts, from: Counts) => {
  for (const [k, [g, w]] of Object.entries(from ?? {})) {
    const v = (into[k] ??= [0, 0]);
    v[0] += g;
    v[1] += w;
  }
};
const cmpPatch = (a: string, b: string) => {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
};

// 3개 서버를 합친 최신 패치 데이터 (게임이 너무 적으면 직전 패치까지 합칩니다)
type AramData = { patch: string | null; updatedAt: string | null; matches: Record<string, number>; champs: Record<string, AramChamp> };
let aramCache: { stamp: string; data: AramData } | null = null;

export function loadAram(): AramData {
  // 파일 이름이 패치 번호라서, JSON을 열기 전에 필요한 패치만 고를 수 있어요
  const files: { file: string; patch: string }[] = [];
  for (const s of SERVERS) {
    const dir = path.join(ROOT, s);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (/^\d+\.\d+\.json$/.test(f)) files.push({ file: path.join(dir, f), patch: f.slice(0, -5) });
  }
  const stamp = files.map((f) => `${f.file}:${fs.statSync(f.file).mtimeMs}`).join("|");
  if (aramCache?.stamp === stamp) return aramCache.data;
  const patches = [...new Set(files.map((f) => f.patch))].sort(cmpPatch).reverse();
  const out: AramData = { patch: patches[0] ?? null, updatedAt: null, matches: {}, champs: {} };
  let used = 0;
  for (const p of patches) {
    if (used >= 2 || (used === 1 && Object.values(out.matches).reduce((a, b) => a + b, 0) >= 1500)) break;
    used++;
    // 무료 서버 메모리가 작아서 파일을 하나씩 읽고 바로 합쳐요
    for (const { file } of files.filter((x) => x.patch === p)) {
      const f = JSON.parse(fs.readFileSync(file, "utf8")) as AramFile;
      if (!out.updatedAt || f.updatedAt > out.updatedAt) out.updatedAt = f.updatedAt;
      for (const [m, n] of Object.entries(f.matches)) out.matches[m] = (out.matches[m] ?? 0) + n;
      for (const [k, c] of Object.entries(f.champs)) {
        const t = (out.champs[k] ??= { games: 0, wins: 0, items: {}, builds: {}, boots: {}, augments: {}, augSets: {}, spells: {}, runes: {} });
        t.games += c.games;
        t.wins += c.wins;
        for (const key of ["items", "builds", "boots", "augments", "augSets", "spells", "runes"] as const) add(t[key], c[key]);
        for (const key of ["with", "vs"] as const) if (c[key]) add((t[key] ??= {}), c[key]);
      }
    }
  }
  // 3판 미만 조합은 화면 어디에도 안 쓰여요(빌드·룬·아이템·같은 팀·상대는 최소 3~5판부터 보여줘요).
  // 서버 3개를 합친 뒤 버리면 메모리가 절반쯤으로 줄어요 (26MB → 13MB, 512MB 서버라 중요해요)
  for (const t of Object.values(out.champs))
    for (const key of ["builds", "runes", "items", "spells", "boots", "with", "vs"] as const) {
      const m = t[key];
      if (m) t[key] = Object.fromEntries(Object.entries(m).filter(([, [g]]) => g >= 3));
    }
  aramCache = { stamp, data: out };
  return out;
}

export function loadAugments(): Record<string, AugmentMeta> {
  const f = path.join(ROOT, "augments.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}

export type Row = { key: string; games: number; winRate: number; pickRate: number };
// 표본이 적은 조합이 1위로 튀지 않도록 챔피언 평균 쪽으로 당긴 점수로 정렬합니다
export function ranked(counts: Counts, total: number, base: number, minGames: number, n: number, by: "score" | "pick" = "score"): Row[] {
  const PRIOR = 8;
  return Object.entries(counts ?? {})
    .filter(([, [g]]) => g >= minGames)
    .map(([key, [g, w]]) => ({ key, games: g, winRate: (w / g) * 100, pickRate: (g / Math.max(1, total)) * 100, score: (w + (base / 100) * PRIOR) / (g + PRIOR) }))
    .sort((a, b) => (by === "pick" ? b.games - a.games : b.score - a.score))
    .slice(0, n);
}

export const modeName = (m: AramMode, ko: boolean) => (m === "mayhem" ? (ko ? "증바람 (증강 칼바람)" : "ARAM: Mayhem") : ko ? "칼바람 나락" : "ARAM");

// 승률이 가장 낮은 쪽 (만나면 힘든 상대). 표본 보정은 ranked 와 같아요
export function rankedLow(counts: Counts, total: number, base: number, minGames: number, n: number): Row[] {
  return ranked(counts, total, base, minGames, 9999).reverse().slice(0, n);
}
