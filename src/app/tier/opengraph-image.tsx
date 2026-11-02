import { ImageResponse } from "next/og";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { LANES } from "@/lib/lanes";
import { boards } from "@/lib/stats";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats tier list";
export const dynamic = "force-dynamic";

const LANE_EN: Record<string, string> = { top: "TOP", jungle: "JUNGLE", mid: "MID", bottom: "BOT", support: "SUPPORT" };

// 티어표 링크를 공유할 때 보이는 미리보기: 한국 서버 최신 패치의 라인별 1위 (한글 폰트가 없어서 영어만)
export default async function Og() {
  const [{ version, champions }, allPatches] = await Promise.all([getChampions("en_US"), getPatches()]);
  let patch = "";
  const tops = LANES.flatMap((l) => {
    const b = boards(champions, l.id, { server: "kr", rank: "all" }, allPatches);
    patch = b.patches.at(-1) ?? patch;
    const s = b.source === "real" ? b.boards.at(-1)?.[0] : undefined;
    return s ? [{ lane: l.id, s }] : [];
  });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#13203a,#070d17)", color: "#f0e6d2", padding: "56px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a09b8c" }}>{patch ? `Patch ${patch} · KR ranked` : "KR ranked"}</div>
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 64, fontWeight: 900 }}>Tier list: #1 in every lane</div>
        <div style={{ display: "flex", marginTop: 44, justifyContent: "space-between" }}>
          {tops.map(({ lane, s }) => (
            <div key={lane} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: "#c8aa6e", letterSpacing: 2 }}>{LANE_EN[lane]}</div>
              <img src={img.champion(version, s.champion.image.full)} alt="" width={150} height={150} style={{ width: 150, height: 150, marginTop: 14, borderRadius: 20, border: "3px solid #c8aa6e" }} />
              <div style={{ display: "flex", marginTop: 14, fontSize: 30, fontWeight: 800 }}>{s.champion.name}</div>
              <div style={{ display: "flex", marginTop: 4, fontSize: 30, fontWeight: 900, color: s.winRate >= 50 ? "#4ade80" : "#f87171" }}>{s.winRate.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
