import { ImageResponse } from "next/og";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { patchSwings } from "@/lib/stats";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats patch winners and losers";
export const dynamic = "force-dynamic";

const LANE_EN: Record<string, string> = { top: "Top", jungle: "Jungle", mid: "Mid", bottom: "Bot", support: "Support" };

// 패치 트렌드 링크를 공유할 때 보이는 미리보기: 한국 서버에서 이번 패치에 승률이 가장 오른 3명, 내린 3명 (한글 폰트가 없어서 영어만)
export default async function Og() {
  const [{ version, champions }, allPatches] = await Promise.all([getChampions("en_US"), getPatches()]);
  const sw = patchSwings(champions, { server: "kr", rank: "all" }, allPatches, 3);
  const cols = sw ? [
    { title: "WINNERS", color: "#4ade80", rows: sw.up },
    { title: "LOSERS", color: "#f87171", rows: sw.down },
  ] : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#13203a,#070d17)", color: "#f0e6d2", padding: "52px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a09b8c" }}>{sw ? `${sw.matches.toLocaleString("en-US")} KR ranked games` : "KR ranked"}</div>
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 60, fontWeight: 900 }}>{sw ? `Patch ${sw.patch}: winners and losers` : "Patch trends"}</div>
        <div style={{ display: "flex", marginTop: 30, justifyContent: "space-between" }}>
          {cols.map((c) => (
            <div key={c.title} style={{ display: "flex", flexDirection: "column", width: 520 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: c.color, letterSpacing: 3 }}>{c.title}</div>
              {c.rows.map((r) => (
                <div key={`${r.champion.id}${r.lane}`} style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
                  <img src={img.champion(version, r.champion.image.full)} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: 16, border: `3px solid ${c.color}` }} />
                  <div style={{ display: "flex", flexDirection: "column", marginLeft: 20, flexGrow: 1 }}>
                    <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>{r.champion.name}</div>
                    <div style={{ display: "flex", fontSize: 24, color: "#a09b8c" }}>{`${LANE_EN[r.lane] ?? r.lane} · ${r.before.toFixed(1)}% to ${r.winRate.toFixed(1)}%`}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 900, color: c.color }}>{`${r.change >= 0 ? "+" : ""}${r.change.toFixed(1)}`}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
