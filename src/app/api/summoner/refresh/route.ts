// 소환사 업데이트 버튼: 이 소환사의 캐시(계정·랭크·최근 게임 목록)를 비워 다음 화면에서 새로 받게 합니다.
// 키 한도를 지키려고 같은 소환사는 60초에 한 번만 받습니다.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { parseServer } from "@/lib/lanes";
import { parseRiotId, summonerTag } from "@/lib/riot";

const COOLDOWN = 60_000;
const last = new Map<string, number>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; server?: string };
  const server = parseServer(body.server);
  const parsed = body.id ? parseRiotId(String(body.id).slice(0, 60), server) : null;
  if (!parsed) return NextResponse.json({ ok: false }, { status: 400 });
  const tag = summonerTag(server, parsed.gameName, parsed.tagLine);
  const wait = (last.get(tag) ?? 0) + COOLDOWN - Date.now();
  if (wait > 0) return NextResponse.json({ ok: false, wait: Math.ceil(wait / 1000) }, { status: 429 });
  last.set(tag, Date.now());
  revalidateTag(tag);
  return NextResponse.json({ ok: true });
}
