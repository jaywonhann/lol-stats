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
  const items = list
    .map((e) => ({ e, sc: score(e) }))
    .filter((x) => x.sc >= 0)
    .sort((a, b) => a.sc - b.sc || a.e.who.localeCompare(b.e.who))
    .slice(0, 8)
    .map((x) => ({ who: x.e.who, label: x.e.label, server: x.e.s }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
