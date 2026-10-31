import { ImageResponse } from "next/og";
import { getChampion, img } from "@/lib/ddragon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats champion stats";

// 챔피언 페이지 링크를 공유할 때 보이는 미리보기 (영어 이름만: 한글 폰트가 없어서)
export default async function Og({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getChampion(id, "en_US").catch(() => null);
  const name = data?.champion.name ?? id;
  const title = data?.champion.title ?? "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#070d17", color: "white" }}>
        <img src={img.splash(id)} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.55 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg,#070d17 10%,rgba(14,17,23,0.2))" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 112, fontWeight: 900, lineHeight: 1 }}>{name}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 36, color: "#c3cbdc", textTransform: "capitalize" }}>{title}</div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 32, color: "#ffe14d" }}>Win rate · Runes · Builds · Matchups</div>
        </div>
      </div>
    ),
    size,
  );
}
