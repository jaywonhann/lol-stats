import { ImageResponse } from "next/og";

export const alt = "livelol.stats - Your games, decoded.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 링크를 공유할 때(스레드, 카톡, 디스코드) 보이는 미리보기 카드
export default function OgImage() {
  const pts = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return [230 + Math.cos(a) * 170, 230 + Math.sin(a) * 170];
  });
  const val = [0.78, 0.9, 0.8, 0.32, 0.74, 0.86].map((v, i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return [230 + Math.cos(a) * 170 * v, 230 + Math.sin(a) * 170 * v];
  });
  const poly = (p: number[][]) => p.map((x) => x.join(",")).join(" ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px",
          color: "white",
          background: "linear-gradient(135deg,#0b1020,#120a2a 60%,#07090f)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 96, fontWeight: 900, lineHeight: 1 }}>
            <span>Your games,</span>
            <span style={{ color: "#ffe14d" }}>decoded.</span>
          </div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 32, color: "#aab3c8" }}>One fix from your last 20 games. Free.</div>
        </div>
        <svg width="460" height="460" viewBox="0 0 460 460">
          <polygon points={poly(pts)} fill="none" stroke="#5b6b8c" strokeWidth="3" />
          <polygon points={poly(val)} fill="rgba(200,170,110,0.4)" stroke="#f0e6d2" strokeWidth="8" strokeLinejoin="round" />
          <circle cx={val[3][0]} cy={val[3][1]} r="16" fill="#ff4d5e" stroke="#fff" strokeWidth="4" />
        </svg>
      </div>
    ),
    size,
  );
}
