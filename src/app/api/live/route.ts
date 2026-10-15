// 지금 게임 중인 상위 랭커(마스터+) 수 추정.
// Riot은 서버 접속자 수를 공개하지 않아서, 마스터+ 랭커 일부가 지금 게임 중인지 확인해 전체 인원에 비율을 곱합니다.
// Vercel 환경변수 RIOT_API_KEY 가 있어야 동작하고, 결과는 1분 동안 CDN에 캐시됩니다.
import { NextResponse } from "next/server";
import { parseServer, type Server } from "@/lib/lanes";

export const dynamic = "force-dynamic";

const SAMPLE = 20;
const key = () =>
  process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();

const ladders = new Map<Server, { at: number; puuids: string[] }>();

async function riot(url: string) {
  const res = await fetch(url, { headers: { "X-Riot-Token": key()! }, cache: "no-store" });
  return res;
}

async function ladder(server: Server) {
  const hit = ladders.get(server);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.puuids;
  const puuids: string[] = [];
  for (const l of ["challengerleagues", "grandmasterleagues", "masterleagues"]) {
    const res = await riot(`https://${server}.api.riotgames.com/lol/league/v4/${l}/by-queue/RANKED_SOLO_5x5`);
    if (res.status === 401 || res.status === 403) throw new Error("key");
    if (!res.ok) continue;
    const data = (await res.json()) as { entries: { puuid?: string }[] };
    puuids.push(...data.entries.map((e) => e.puuid).filter((p): p is string => !!p));
  }
  if (puuids.length) ladders.set(server, { at: Date.now(), puuids });
  return puuids;
}

export async function GET(req: Request) {
  const server = parseServer(new URL(req.url).searchParams.get("server") ?? undefined);
  if (!key()) return NextResponse.json({ available: false, reason: "no-key" });
  try {
    const all = await ladder(server);
    if (!all.length) return NextResponse.json({ available: false, reason: "no-ladder" });
    const sample = [...all].sort(() => Math.random() - 0.5).slice(0, SAMPLE);
    let checked = 0;
    let inGame = 0;
    await Promise.all(
      sample.map(async (puuid) => {
        const res = await riot(`https://${server}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`);
        if (res.status === 401 || res.status === 403) throw new Error("key");
        if (res.status === 200) {
          checked++;
          inGame++;
        } else if (res.status === 404) checked++;
      }),
    );
    if (!checked) return NextResponse.json({ available: false, reason: "busy" });
    return NextResponse.json(
      {
        available: true,
        server,
        total: all.length,
        checked,
        inGame,
        estimate: Math.round((inGame / checked) * all.length),
        at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } },
    );
  } catch (e) {
    const reason = e instanceof Error && e.message === "key" ? "key-rejected" : "error";
    return NextResponse.json({ available: false, reason });
  }
}
