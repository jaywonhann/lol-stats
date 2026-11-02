// PRO 라이선스 키 등록(POST)과 이 기기에서 해제(DELETE)
import { NextResponse, type NextRequest } from "next/server";
import { activate, cleanKey, deactivate, PRO_COOKIE, readCookie } from "@/lib/pro";

export const dynamic = "force-dynamic";

// 같은 IP에서 키를 마구 넣어 보는 걸 막는 간단한 제한 (인스턴스마다 따로 세요)
const tries = new Map<string, { n: number; at: number }>();
const limited = (ip: string) => {
  const now = Date.now();
  const t = tries.get(ip);
  if (!t || now - t.at > 10 * 60 * 1000) {
    tries.set(ip, { n: 1, at: now });
    return false;
  }
  t.n++;
  return t.n > 10;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (limited(ip)) return NextResponse.json({ ok: false, reason: "slow" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const r = await activate(cleanKey(body?.key));
  if (!r.ok) return NextResponse.json(r, { status: r.reason === "unavailable" ? 503 : 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRO_COOKIE, JSON.stringify(r.cookie), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const c = readCookie(req.cookies.get(PRO_COOKIE)?.value);
  if (c) await deactivate(c);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PRO_COOKIE);
  return res;
}
