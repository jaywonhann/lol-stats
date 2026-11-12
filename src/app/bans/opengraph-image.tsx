import { patchName } from "@/lib/lanes";
import { ImageResponse } from "next/og";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES } from "@/lib/lanes";
import { boards } from "@/lib/stats";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats who to ban this patch";
export const dynamic = "force-dynamic";

// 밴 추천 링크 미리보기: 페이지와 같은 기준(KR 전체 랭크, 100판 이상)으로 TOP 5 (한글 폰트가 없어서 영어만)
export default async function Og() {
  const [{ version, champions }, allPatches] = await Promise.all([getChampions("en_US"), getPatches()]);
  let patch = "";
  const main = new Map<string, { file: string; name: string; wr: number; pr: number; games: number }>();
  for (const { id: lane } of LANES) {
    const b = boards(champions, lane, { server: "kr", rank: "all" }, allPatches);
    if (b.source !== "real") continue;
    patch = b.patches[b.patches.length - 1];
    for (const s of b.boards[b.boards.length - 1] ?? []) {
      if (s.games < 100) continue;
      const cur = main.get(s.champion.id);
      if (!cur || cur.games < s.games)
        main.set(s.champion.id, { file: s.champion.image.full, name: s.champion.name, wr: s.winRate, pr: s.pickRate, games: s.games });
    }
  }
  const top = [...main.values()]
    .filter((r) => r.wr > 50)
    .sort((a, b) => (b.wr - 50) * Math.sqrt(b.pr) - (a.wr - 50) * Math.sqrt(a.pr))
    .slice(0, 5);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#2a1218,#070d17)", color: "#f0e6d2", padding: "52px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a09b8c" }}>{patch ? `Patch ${patchName(patch)} · KR ranked` : "Ranked games"}</div>
        </div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 64, fontWeight: 900 }}>Who to ban this patch</div>
        <div style={{ display: "flex", marginTop: 48, justifyContent: "space-between" }}>
          {top.map((r, i) => (
            <div key={r.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
              <div style={{ display: "flex", position: "relative" }}>
                <img src={img.champion(version, r.file)} alt="" width={150} height={150} style={{ width: 150, height: 150, borderRadius: 20, border: "4px solid #e84057" }} />
                <div style={{ display: "flex", position: "absolute", top: -14, left: -14, width: 44, height: 44, borderRadius: 22, background: "#e84057", color: "#fff", fontSize: 26, fontWeight: 900, alignItems: "center", justifyContent: "center" }}>
                  {String(i + 1)}
                </div>
              </div>
              <div style={{ display: "flex", marginTop: 16, fontSize: 28, fontWeight: 800 }}>{r.name}</div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 900, color: "#4ade80" }}>{`${r.wr.toFixed(1)}%`}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
