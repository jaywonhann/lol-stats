// 사이트 피드백을 GitHub 이슈로 남깁니다. 토큰은 Vercel 환경변수 FEEDBACK_TOKEN (GitHub 시크릿에서 자동 복사).
// 스팸 방지: 숨은 입력칸(website)이 채워졌으면 무시, 같은 IP는 1분에 2번까지.
import { NextResponse } from "next/server";

// 피드백은 비공개 저장소의 이슈로 쌓입니다 (공개 저장소에 올리면 누구나 볼 수 있어서)
const REPO = process.env.FEEDBACK_REPO?.trim() || "jaywonhann/lol-stats-feedback";
const RATINGS = { good: "😀 좋아요", okay: "😐 보통", bad: "😞 별로" } as const;
const hits = new Map<string, number[]>();

const token = () => process.env.FEEDBACK_TOKEN?.trim() || undefined;

export async function GET() {
  return NextResponse.json({ available: !!token() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  if (str("website", 200)) return NextResponse.json({ ok: true }); // 봇
  const message = str("message", 2000);
  const rating = str("rating", 10) as keyof typeof RATINGS;
  if (!message && !(rating in RATINGS)) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  const t = token();
  if (!t) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((x) => now - x < 60_000);
  if (recent.length >= 2) return NextResponse.json({ ok: false, reason: "slow" }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const contact = str("contact", 120);
  const page = str("page", 200);
  const lang = str("lang", 5);
  const line = message.split("\n")[0].slice(0, 60);
  const title = `[피드백] ${rating in RATINGS ? RATINGS[rating] : ""} ${line}`.trim();
  const quote = (s: string) => s.replace(/@/g, "@​"); // 멘션 방지
  const issue = [
    `**평가:** ${rating in RATINGS ? RATINGS[rating] : "-"}`,
    "",
    "**내용:**",
    "",
    message ? quote(message).split("\n").map((l) => `> ${l}`).join("\n") : "> (없음)",
    "",
    `**연락처:** ${contact ? quote(contact) : "-"}`,
    `**페이지:** ${page || "-"} · **언어:** ${lang || "-"}`,
    "",
    "_livelol.stats 피드백 양식으로 접수됨_",
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "livelol-stats-feedback",
    },
    body: JSON.stringify({ title, body: issue }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ ok: false, reason: "error" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
