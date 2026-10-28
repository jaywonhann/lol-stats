import { NextResponse } from "next/server";

// 영어 진입 주소: /en 으로 들어오면 영어로 설정하고 이동합니다 (?to=/tier 지원, 서버는 그대로 둡니다)
export function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("to") ?? "/";
  const dest = to.startsWith("/") && !to.startsWith("//") ? to : "/";
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set("lang", "en", { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
