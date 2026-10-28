import { NextResponse } from "next/server";

// 한국어 진입 주소: livelol 주소/ko 로 들어오면 한국 서버·한국어로 설정하고 이동합니다 (?to=/tier 처럼 이동할 곳도 지정 가능)
export function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("to") ?? "/";
  const dest = to.startsWith("/") && !to.startsWith("//") ? to : "/";
  const res = NextResponse.redirect(new URL(dest, req.url));
  const opts = { path: "/", maxAge: 31536000, sameSite: "lax" as const };
  res.cookies.set("lang", "ko", opts);
  res.cookies.set("server", "kr", opts);
  return res;
}
