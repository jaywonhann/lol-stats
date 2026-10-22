// 커뮤니티 글/댓글 작성. 스팸 방지: 숨은 입력칸, IP당 제한, 링크/길이 제한, 금칙어.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CATS, createComment, createPost, token, type Cat } from "@/lib/community";

const hits = new Map<string, number[]>();
const BAD = /(카지노|바카라|토토|먹튀|대출|성인|야동|18\+|casino|viagra|porn|bitcoin|crypto|telegram|텔레그램|t\.me\/)/i;
const LINKS = /https?:\/\/|www\.|\.com\b|\.kr\b|\.net\b|\.xyz\b/gi;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string, max: number) =>
    typeof b[k] === "string" ? (b[k] as string).replace(/<!--/g, "").replace(/@/g, "@​").trim().slice(0, max) : "";
  if (str("website", 100)) return NextResponse.json({ ok: true }); // 봇
  if (!token()) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });

  const nick = str("nick", 16).replace(/[\r\n-]/g, " ") || "익명";
  const body = str("body", 3000);
  const kind = b.kind === "comment" ? "comment" : "post";
  const title = str("title", 80).replace(/[\r\n]/g, " ");
  if (body.length < 2 || (kind === "post" && title.length < 2)) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  const text = `${nick} ${title} ${body}`;
  if (BAD.test(text) || (text.match(LINKS)?.length ?? 0) > 1) return NextResponse.json({ ok: false, reason: "blocked" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((x) => now - x < 60_000);
  if (recent.length >= (kind === "post" ? 1 : 3)) return NextResponse.json({ ok: false, reason: "slow" }, { status: 429 });
  hits.set(ip, [...recent, now]);

  if (kind === "comment") {
    const n = Number(b.n);
    if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
    if (!(await createComment(n, nick, body))) return NextResponse.json({ ok: false, reason: "error" }, { status: 502 });
    revalidateTag("community");
    return NextResponse.json({ ok: true, n });
  }
  const cat = (CATS as readonly string[]).includes(String(b.cat)) ? (b.cat as Cat) : "free";
  const n = await createPost({ cat, title, nick, body });
  if (!n) return NextResponse.json({ ok: false, reason: "error" }, { status: 502 });
  revalidateTag("community");
  return NextResponse.json({ ok: true, n });
}
