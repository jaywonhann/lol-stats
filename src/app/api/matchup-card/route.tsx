import { ImageResponse } from "next/og";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { parseLane } from "@/lib/lanes";
import { loadRealData } from "@/lib/real";

// 상성 페이지 링크 미리보기 (A vs B 승률). 글꼴 문제로 영문만 씁니다.
const LANE_EN = { top: "Top", jungle: "Jungle", mid: "Mid", bottom: "Bot", support: "Support" } as const;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lane = parseLane(u.searchParams.get("lane") ?? undefined);
  const [{ champions }, patches] = await Promise.all([getChampions("en_US"), getPatches().catch(() => [] as string[])]);
  const A = champions.find((c) => c.id === u.searchParams.get("a"));
  const B = champions.find((c) => c.id === u.searchParams.get("b"));
  if (!A || !B) return new Response("bad champions", { status: 400 });

  // 세 서버 최신 패치를 합친 실제 승률
  let g = 0;
  let w = 0;
  for (const server of ["kr", "na1", "euw1"] as const) {
    const real = loadRealData({ server, rank: "all" });
    const patch = [...patches].reverse().find((p) => real.has(p));
    const [vg, vw] = (patch && real.get(patch)!.champs[`${A.key}:${lane}`]?.vs[B.key]) || [0, 0];
    g += vg;
    w += vw;
  }
  const rate = g >= 3 ? (w / g) * 100 : null;
  const color = rate === null ? "#a09b8c" : rate >= 50 ? "#4ade80" : "#f87171";

  const side = (c: typeof A, align: "left" | "right") => (
    <div style={{ position: "absolute", top: 0, bottom: 0, [align]: 0, width: 600, display: "flex", overflow: "hidden" }}>
      <img src={img.splash(c.id)} alt="" width={1215} height={717} style={{ position: "absolute", top: -40, [align]: -300, width: 1215, height: 717, objectFit: "cover", opacity: 0.5 }} />
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#070d17", color: "#f0e6d2" }}>
        {side(A, "left")}
        {side(B, "right")}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 50% 55%, rgba(7,13,23,0.92) 25%, rgba(7,13,23,0.35) 75%)" }} />
        <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats · {LANE_EN[lane]} matchup
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 36, fontSize: 84, fontWeight: 900 }}>
            {A.name}
            <span style={{ margin: "0 32px", fontSize: 48, color: "#a09b8c" }}>vs</span>
            {B.name}
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 120, fontWeight: 900, color }}>{rate === null ? "?" : `${rate.toFixed(1)}%`}</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: "#a09b8c" }}>
            {rate === null ? "Not enough games yet" : `${A.name} win rate · ${g.toLocaleString("en-US")} ranked games`}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } },
  );
}
