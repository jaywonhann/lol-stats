import { patchName } from "@/lib/lanes";
import { ImageResponse } from "next/og";
import { getChampion, getChampions, img } from "@/lib/ddragon";
import { latest, rows } from "@/lib/counters";
import { realLanes } from "@/lib/real";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats champion counters";

const LANE_EN: Record<string, string> = { top: "Top", jungle: "Jungle", mid: "Mid", bottom: "Bot", support: "Support" };

// "야스오 카운터" 링크 미리보기: 주 라인 기준 카운터 TOP 5 (KR 에메랄드+, 한글 폰트가 없어서 영어만)
// 일러스트 없이 아이콘만 써서 이미지가 가볍게 (메모리 아끼기)
export default async function Og({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, { champions }] = await Promise.all([getChampion(id, "en_US").catch(() => null), getChampions("en_US")]);
  const name = data?.champion.name ?? id;
  const patch = latest("kr");
  const lane = data && patch ? realLanes(patch, data.champion)[0] : undefined;
  const r = data && patch && lane ? rows(patch, data.champion, lane, champions) : null;
  const top = r?.counters.slice(0, 5) ?? [];
  const version = data?.version ?? "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#131c2e,#070d17)", color: "#f0e6d2", padding: "52px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a09b8c" }}>{patch && lane ? `${LANE_EN[lane]} · patch ${patchName(patch.patch)} · KR ranked` : "Ranked games"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
          {data && <img src={img.champion(version, data.champion.image.full)} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: 16, border: "3px solid #c8aa6e", marginRight: 24 }} />}
          <div style={{ display: "flex", fontSize: 72, fontWeight: 900 }}>{`${name} counters`}</div>
        </div>
        <div style={{ display: "flex", marginTop: 44, justifyContent: top.length >= 4 ? "space-between" : "flex-start" }}>
          {top.map((m, i) => (
            <div key={m.champion.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
              <div style={{ display: "flex", position: "relative" }}>
                <img src={img.champion(version, m.champion.image.full)} alt="" width={140} height={140} style={{ width: 140, height: 140, borderRadius: 20, border: "4px solid #e84057" }} />
                <div style={{ display: "flex", position: "absolute", top: -14, left: -14, width: 44, height: 44, borderRadius: 22, background: "#e84057", color: "#fff", fontSize: 26, fontWeight: 900, alignItems: "center", justifyContent: "center" }}>
                  {String(i + 1)}
                </div>
              </div>
              <div style={{ display: "flex", marginTop: 14, fontSize: 28, fontWeight: 800 }}>{m.champion.name}</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 900, color: "#4ade80" }}>{`${(100 - m.winRate).toFixed(1)}% win`}</div>
            </div>
          ))}
          {!top.length && <div style={{ display: "flex", fontSize: 34, color: "#a09b8c" }}>Best picks against {name}, from real ranked games</div>}
        </div>
      </div>
    ),
    size,
  );
}
