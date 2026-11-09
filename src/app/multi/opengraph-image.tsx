import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats multi-search";

const TIERS = ["gold", "platinum", "emerald", "diamond", "master"];

// 멀티서치 링크 미리보기 (한글 폰트가 없어서 영어만). 랭크 엠블럼은 public/emblems 에 있는 파일을 그대로 써요
export default async function Og() {
  const emblems = await Promise.all(
    TIERS.map((t) =>
      readFile(path.join(process.cwd(), "public", "emblems", `${t}.png`))
        .then((b) => `data:image/png;base64,${b.toString("base64")}`)
        .catch(() => null),
    ),
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#13203a,#070d17)", color: "#f0e6d2", padding: "52px 64px" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
          live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 72, fontWeight: 900 }}>Multi-search</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 34, color: "#a09b8c" }}>Paste your lobby chat. See all five teammates at once.</div>
        <div style={{ display: "flex", marginTop: 40, justifyContent: "space-between" }}>
          {emblems.map((src, i) =>
            src ? (
              <img key={TIERS[i]} src={src} alt="" width={180} height={180} style={{ width: 180, height: 180, objectFit: "contain" }} />
            ) : (
              <div key={TIERS[i]} style={{ display: "flex", width: 180, height: 180 }} />
            ),
          )}
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#c8aa6e" }}>Rank · recent form · main role · champions · bans for your team</div>
      </div>
    ),
    size,
  );
}
