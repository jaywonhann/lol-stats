import { ImageResponse } from "next/og";
import { getChampions, img } from "@/lib/ddragon";
import { loadAram, MIN_ARAM_GAMES, parseMode } from "@/lib/aram";

// 칼바람 챔피언 페이지 링크 미리보기 (승률 + 가장 많이 가는 코어템 3개). 글꼴 문제로 영문만 씁니다.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const { version, champions } = await getChampions("en_US");
  const champ = champions.find((c) => c.id.toLowerCase() === (u.searchParams.get("id") ?? "").toLowerCase());
  if (!champ) return new Response("bad champion", { status: 400 });
  const data = loadAram();
  const mode = parseMode(u.searchParams.get("mode") ?? undefined, !!data.matches.mayhem);
  const a = data.champs[`${mode}:${champ.key}`];
  const ok = a && a.games >= MIN_ARAM_GAMES;
  const rate = ok ? (a.wins / a.games) * 100 : null;
  const items = ok
    ? Object.entries(a.items)
        .sort((x, y) => y[1][0] - x[1][0])
        .slice(0, 3)
        .map(([id]) => id)
    : [];
  const color = rate === null ? "#a09b8c" : rate >= 50 ? "#4ade80" : "#f87171";
  const label = mode === "mayhem" ? "ARAM: Mayhem" : "ARAM";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#070d17", color: "#f0e6d2" }}>
        <img src={img.splash(champ.id)} alt="" width={1215} height={717} style={{ position: "absolute", top: -40, right: -200, width: 1215, height: 717, objectFit: "cover", opacity: 0.55 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(7,13,23,0.97) 40%, rgba(7,13,23,0.2) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900 }}>
            live<span style={{ color: "#c8aa6e" }}>lol</span>.stats · {label} build
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 96, fontWeight: 900 }}>{champ.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 88, fontWeight: 900, color }}>{rate === null ? "?" : `${rate.toFixed(1)}%`}</span>
            <span style={{ marginLeft: 18, fontSize: 30, color: "#a09b8c" }}>
              {rate === null ? "Not enough games yet" : `win rate · ${a.games.toLocaleString("en-US")} games`}
            </span>
          </div>
          {items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
              <span style={{ fontSize: 26, color: "#a09b8c", marginRight: 18 }}>Core items</span>
              {items.map((id) => (
                <img key={id} src={img.item(version, id)} alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 12, marginRight: 12, border: "2px solid #c8aa6e" }} />
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } },
  );
}
