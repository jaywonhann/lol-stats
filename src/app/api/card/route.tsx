import { ImageResponse } from "next/og";
import { growth, HEX } from "@/lib/growth";
import { parseRiotId, lookupSummoner } from "@/lib/riot";
import { scoreReport } from "@/lib/score";
import { parseServer } from "@/lib/lanes";

// 소환사 공유 카드(링크 미리보기용 이미지). 글꼴 문제로 영문만 씁니다.
const LABEL: Record<string, string> = { dmg: "DMG", kp: "KP", survive: "SURVIVE", vision: "VISION", growth: "GROWTH", steady: "STEADY" };

export async function GET(req: Request) {
  const u = new URL(req.url);
  const server = parseServer(u.searchParams.get("s") ?? "kr");
  const parsed = parseRiotId((u.searchParams.get("id") ?? "").slice(0, 60), server);
  if (!parsed) return new Response("bad id", { status: 400 });
  try {
    const r = await lookupSummoner(server, parsed.gameName, parsed.tagLine, 20);
    const score = scoreReport(r.matches, r.account.puuid, r.timelines);
    if (!score) return new Response("no games", { status: 404 });
    const g = growth(score);
    const c = 200;
    const pt = (i: number, v: number) => {
      const a = ((-90 + 60 * i) * Math.PI) / 180;
      return [c + Math.cos(a) * 150 * v, c + Math.sin(a) * 150 * v];
    };
    const poly = (ps: number[][]) => ps.map((p) => p.join(",")).join(" ");
    const outer = HEX.map((_, i) => pt(i, 1));
    const val = HEX.map((k, i) => pt(i, Math.max(0.08, g.hex[k] / 100)));
    const weakIdx = HEX.indexOf(g.weakest);
    const wins = r.matches.filter((m) => m.info.participants.find((p) => p.puuid === r.account.puuid)?.win).length;
    const total = r.matches.length;
    const rank = r.solo ? `${r.solo.tier} ${r.solo.rank} · ${r.solo.leaguePoints} LP` : "Unranked";
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", color: "white", background: "linear-gradient(135deg,#0b1020,#120a2a 60%,#07090f)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
              live<span style={{ color: "#2dd4bf" }}>lol</span>.stats
            </div>
            <div style={{ display: "flex", marginTop: 34, fontSize: 64, fontWeight: 900 }}>{r.account.gameName}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#8b94a7" }}>#{r.account.tagLine}</div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 36, fontWeight: 800, color: "#ffe14d" }}>{rank}</div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: "#5df2a0" }}>
              {wins}W {total - wins}L in the last {total} games
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: "#ff5d6c" }}>One fix: {LABEL[g.weakest]}</div>
          </div>
          <svg width="420" height="420" viewBox="0 0 400 400">
            {[0.33, 0.66, 1].map((v) => (
              <polygon key={v} points={poly(HEX.map((_, i) => pt(i, v)))} fill="none" stroke="#5b6b8c" strokeWidth="2" />
            ))}
            <polygon points={poly(val)} fill="rgba(45,212,191,0.4)" stroke="#9ff7e8" strokeWidth="6" strokeLinejoin="round" />
            <circle cx={val[weakIdx][0]} cy={val[weakIdx][1]} r="12" fill="#ff4d5e" stroke="#fff" strokeWidth="3" />
            {outer.map((p, i) => (
              <text key={i} x={pt(i, 1.2)[0]} y={pt(i, 1.2)[1] + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={i === weakIdx ? "#ff5d6c" : "#8b94a7"}>
                {LABEL[HEX[i]]}
              </text>
            ))}
          </svg>
        </div>
      ),
      { width: 1200, height: 630, headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return new Response("unavailable", { status: 503 });
  }
}
