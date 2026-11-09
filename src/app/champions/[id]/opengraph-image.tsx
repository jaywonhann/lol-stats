import { ImageResponse } from "next/og";
import { getChampion, img } from "@/lib/ddragon";
import { loadRealData, realLanes } from "@/lib/real";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats champion stats";

const LANE_EN: Record<string, string> = { top: "Top", jungle: "Jungle", mid: "Mid", bottom: "Bot", support: "Support" };

// 실제 랭크 게임(한국 서버, 최신 패치)에서 주 라인 승률과 가장 많이 가는 코어 빌드
function stats(champ: { key: string }) {
  try {
    const real = loadRealData({ server: "kr", rank: "all" });
    const patch = [...real.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).pop();
    if (!patch) return null;
    const data = real.get(patch)!;
    const lane = realLanes(data, champ as Parameters<typeof realLanes>[1])[0];
    if (!lane) return null;
    const c = data.champs[`${champ.key}:${lane}`];
    const seqs = c.core4 && Object.values(c.core4).some(([g]) => g >= 3) ? c.core4 : c.core;
    const build = Object.entries(seqs).sort((a, b) => b[1][0] - a[1][0])[0]?.[0].split(",").slice(0, 3) ?? [];
    return { patch, lane, games: c.games, rate: (c.wins / c.games) * 100, build };
  } catch {
    return null;
  }
}

// 챔피언 페이지 링크를 공유할 때 보이는 미리보기 (영어 이름만: 한글 폰트가 없어서)
export default async function Og({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getChampion(id, "en_US").catch(() => null);
  const name = data?.champion.name ?? id;
  const title = data?.champion.title ?? "";
  const s = data ? stats(data.champion) : null;
  const color = s ? (s.rate >= 50 ? "#4ade80" : "#f87171") : "#ffe14d";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#070d17", color: "white" }}>
        {/* 일러스트는 오른쪽에만: 사진이 차지하는 면적이 줄어야 PNG가 가벼워져요 (1MB → 절반쯤) */}
        <img src={img.splash(id)} alt="" width={760} height={630} style={{ position: "absolute", top: 0, right: 0, width: 760, height: 630, objectFit: "cover", opacity: 0.65 }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "linear-gradient(90deg,#070d17 40%,rgba(7,13,23,0.6) 55%,rgba(7,13,23,0) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats{s ? ` · ${LANE_EN[s.lane]} · patch ${s.patch}` : ""}
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 104, fontWeight: 900, lineHeight: 1 }}>{name}</div>
          {s ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 14 }}>
                <span style={{ fontSize: 80, fontWeight: 900, color }}>{s.rate.toFixed(1)}%</span>
                <span style={{ marginLeft: 18, fontSize: 30, color: "#c3cbdc" }}>win rate · {s.games.toLocaleString("en-US")} ranked games</span>
              </div>
              {data && s.build.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
                  <span style={{ fontSize: 26, color: "#c3cbdc", marginRight: 18 }}>Core build</span>
                  {s.build.map((it) => (
                    <img key={it} src={img.item(data.version, it)} alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 12, marginRight: 12, border: "2px solid #c8aa6e" }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", marginTop: 12, fontSize: 36, color: "#c3cbdc", textTransform: "capitalize" }}>{title}</div>
              <div style={{ display: "flex", marginTop: 40, fontSize: 32, color: "#ffe14d" }}>Win rate · Runes · Builds · Matchups</div>
            </>
          )}
        </div>
      </div>
    ),
    size,
  );
}
