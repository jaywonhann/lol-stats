import { NextResponse } from "next/server";

type Entry = { who: string; label: string; s: string };
let cache: { at: number; list: Entry[] } | null = null;

async function load(): Promise<Entry[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.list;
  try {
    const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
      next: { revalidate: 600 },
    });
    if (!res.ok) return cache?.list ?? [];
    const data = (await res.json()) as { builds: { who: string; label: string; s: string }[] };
    const seen = new Map<string, Entry>();
    for (const b of data.builds) {
      const k = `${b.s}|${b.who}`;
      if (!seen.has(k)) seen.set(k, { who: b.who, label: b.label, s: b.s });
    }
    cache = { at: Date.now(), list: [...seen.values()] };
    return cache.list;
  } catch {
    return cache?.list ?? [];
  }
}

// 수집기가 본 일반 랭커 Riot ID (서버별, 10분 캐시)
const nameCache = new Map<string, { at: number; list: string[] }>();
async function loadNames(server: string): Promise<string[]> {
  if (!/^[a-z0-9]{2,6}$/.test(server)) return [];
  const hit = nameCache.get(server);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.list;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/jaywonhann/lol-stats/main/data/patches/${server}/names.json`, {
      next: { revalidate: 600 },
    });
    const list = res.ok ? ((await res.json()) as unknown[]).filter((x): x is string => typeof x === "string") : [];
    nameCache.set(server, { at: Date.now(), list });
    return list;
  } catch {
    return hit?.list ?? [];
  }
}

// 입력한 글자로 시작하거나 포함하는 프로·챌린저 계정 추천 (최대 8개)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 40);
  const server = searchParams.get("server") ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });
  const list = await load();
  const score = (e: Entry) => {
    const base = e.s === server ? 0 : 10;
    if (e.who.toLowerCase().startsWith(q)) return base;
    if (e.label.toLowerCase().startsWith(q)) return base + 1;
    if (e.who.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)) return base + 2;
    return -1;
  };
  const pros = list
    .map((e) => ({ e, sc: score(e) }))
    .filter((x) => x.sc >= 0)
    .sort((a, b) => a.sc - b.sc || a.e.who.localeCompare(b.e.who))
    .slice(0, 8)
    .map((x) => ({ who: x.e.who, label: x.e.label, server: x.e.s }));
  const taken = new Set(pros.map((i) => i.who.toLowerCase()));
  const players = (await loadNames(server))
    .filter((n) => n.toLowerCase().includes(q) && !taken.has(n.toLowerCase()))
    .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
    .slice(0, 8 - Math.min(pros.length, 4))
    .map((who) => ({ who, label: "", server }));
  const items = [...pros.slice(0, 4), ...players, ...pros.slice(4)].slice(0, 8);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
