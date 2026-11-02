import { ImageResponse } from "next/og";
import { getChampions, img } from "@/lib/ddragon";
import { SERVERS } from "@/lib/lanes";
import { realDuoPairs } from "@/lib/real";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "livelol.stats bot lane duo tier list";
export const dynamic = "force-dynamic";

// 듀오 순위 링크 미리보기: 승률 상위 4개 원딜+서포터 조합 (한글 폰트가 없어서 영어만)
export default async function Og() {
  const { version, champions } = await getChampions("en_US");
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const { pairs, patch, games } = realDuoPairs("all", SERVERS.map((s) => s.id));
  const avg = pairs.reduce((s, p) => s + p.wins, 0) / Math.max(1, games);
  const top = pairs
    .filter((p) => p.games >= 20 && byKey.has(p.adc) && byKey.has(p.sup))
    .map((p) => ({ a: byKey.get(p.adc)!, s: byKey.get(p.sup)!, wr: (p.wins / p.games) * 100, score: (p.wins + avg * 20) / (p.games + 20) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 4);
  const face = (file: string) => (
    <img src={img.champion(version, file)} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: 16, border: "3px solid #c8aa6e" }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#13203a,#070d17)", color: "#f0e6d2", padding: "52px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a09b8c" }}>{patch ? `Patch ${patch} · KR/NA/EUW ranked` : "Ranked games"}</div>
        </div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 60, fontWeight: 900 }}>Best bot lane duos</div>
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 34, justifyContent: "space-between" }}>
          {top.map(({ a, s, wr }) => (
            <div key={`${a.id}-${s.id}`} style={{ display: "flex", alignItems: "center", width: 520, marginBottom: 26 }}>
              {face(a.image.full)}
              <div style={{ display: "flex", margin: "0 10px", fontSize: 36, color: "#a09b8c" }}>+</div>
              {face(s.image.full)}
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>{`${a.name} + ${s.name}`}</div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 900, color: wr >= 50 ? "#4ade80" : "#f87171" }}>{wr.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
