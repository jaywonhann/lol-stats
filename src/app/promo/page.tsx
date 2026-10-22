// 광고용 이미지 캡처 페이지 (검색에 노출되지 않음). 실제 챔피언·아이템·룬·엠블럼 이미지로 포스터를 그립니다.
// 사용: /promo (콜라주), /promo?p=2 (히어로). 브라우저에서 1600×1000으로 화면 캡처하세요.
import type { Metadata } from "next";
import { getChampions, getItems, getRuneTrees, getVersion, img } from "@/lib/ddragon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "livelol.stats", robots: { index: false, follow: false } };

const CHAMPS = ["Ahri", "Jinx", "LeeSin", "Garen", "Yasuo"];
const ITEMS = ["Infinity Edge", "Rabadon's Deathcap", "Zhonya's Hourglass", "Kraken Slayer", "Guardian Angel", "Bloodthirster"];
const TIERS = ["emerald", "diamond", "master", "grandmaster", "challenger"];

const font = '"Inter","Pretendard","Apple SD Gothic Neo",system-ui,sans-serif';

export default async function PromoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const version = await getVersion();
  const [{ champions: list }, items, trees] = await Promise.all([getChampions("en_US"), getItems(version, "en_US"), getRuneTrees(version, "en_US")]);
  const champs = CHAMPS.map((id) => list.find((c) => c.id === id)).filter((c) => !!c);
  const itemIcons = ITEMS.map((n) => items.find((i) => i.name === n && i.gold.purchasable)).filter((i) => !!i);
  const keystones = trees.flatMap((t) => t.slots[0]?.runes ?? []).slice(0, 12);
  const pick = ["Electrocute", "Conqueror", "Press the Attack", "Phase Rush", "Fleet Footwork", "Dark Harvest"]
    .map((n) => keystones.concat(trees.flatMap((t) => t.slots[0]?.runes ?? [])).find((r) => r.name === n))
    .filter((r) => !!r);

  const page: React.CSSProperties = {
    width: 1600, height: 1000, position: "relative", overflow: "hidden", fontFamily: font, color: "#fff",
    background: "radial-gradient(900px 600px at 80% 20%,#1d4ed866,transparent 70%),radial-gradient(700px 500px at 0% 100%,#7c3aed55,transparent 70%),linear-gradient(135deg,#0b1020,#0a0d16)",
  };

  if (p === "2") {
    const hero = champs[0];
    return (
      <div style={{ background: "#05070c", minHeight: "100vh" }}>
        <div style={page}>
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.splash(hero.id)} alt="" style={{ position: "absolute", right: -80, top: -40, height: 1100, objectFit: "cover", maskImage: "linear-gradient(90deg,transparent 0%,#000 35%)", WebkitMaskImage: "linear-gradient(90deg,transparent 0%,#000 35%)" }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#0a0d16 20%,#0a0d1600 70%)" }} />
          <div style={{ position: "absolute", left: 80, top: 80, fontSize: 28, fontWeight: 900, color: "#f87171", border: "3px solid #f87171", borderRadius: 999, padding: "8px 24px", background: "#220d12" }}>● LIVE RANKED DATA</div>
          <div style={{ position: "absolute", left: 76, top: 170, fontSize: 124, fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 0.95 }}>
            Know what<br />wins.<br /><span style={{ color: "#2dd4bf" }}>Right now.</span>
          </div>
          <div style={{ position: "absolute", left: 80, top: 620, display: "flex", gap: 14 }}>
            {champs.slice(0, 5).map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c.id} src={img.champion(version, c.image.full)} alt={c.name} width={92} height={92} style={{ borderRadius: 18, border: "3px solid #2dd4bf" }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 80, top: 740, display: "flex", gap: 12, alignItems: "center" }}>
            {itemIcons.slice(0, 6).map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={img.item(version, i.id)} alt={i.name} width={72} height={72} style={{ borderRadius: 12, border: "2px solid #3b4a6e" }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 80, top: 840, display: "flex", gap: 8 }}>
            {TIERS.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={t} src={`/emblems/${t}.png`} alt={t} width={84} height={84} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 560, top: 860, background: "linear-gradient(90deg,#2dd4bf,#5eead4)", color: "#04201b", fontWeight: 900, fontSize: 40, borderRadius: 999, padding: "20px 44px", boxShadow: "0 0 40px #2dd4bf88" }}>lollive.vercel.app</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#05070c", minHeight: "100vh" }}>
      <div style={page}>
        <div style={{ position: "absolute", left: 80, top: 70, fontSize: 28, fontWeight: 900, color: "#f87171", border: "3px solid #f87171", borderRadius: 999, padding: "8px 24px", background: "#220d12" }}>● LIVE</div>
        <div style={{ position: "absolute", left: 76, top: 150, fontSize: 104, fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 0.96 }}>
          Every champion.<br />Every build.<br /><span style={{ color: "#ffe14d" }}>Live.</span>
        </div>
        <div style={{ position: "absolute", left: 80, top: 520, fontSize: 34, fontWeight: 700, color: "#cfd8ea", lineHeight: 1.3 }}>
          Real ranked data, winning items,<br />runes and your own progress.
        </div>
        <div style={{ position: "absolute", left: 80, top: 650, display: "flex", gap: 12 }}>
          {itemIcons.map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i.id} src={img.item(version, i.id)} alt={i.name} width={78} height={78} style={{ borderRadius: 14, border: "2px solid #3b4a6e", boxShadow: "0 8px 24px #0009" }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 80, top: 750, display: "flex", gap: 14 }}>
          {pick.map((r) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={r.id} src={img.rune(r.icon)} alt={r.name} width={72} height={72} style={{ borderRadius: "50%", background: "#0f1730", border: "2px solid #2dd4bf", padding: 4 }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 80, top: 860, display: "flex", gap: 6 }}>
          {TIERS.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t} src={`/emblems/${t}.png`} alt={t} width={72} height={72} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 560, top: 872, background: "linear-gradient(90deg,#2dd4bf,#5eead4)", color: "#04201b", fontWeight: 900, fontSize: 34, borderRadius: 999, padding: "16px 36px", boxShadow: "0 0 40px #2dd4bf88" }}>lollive.vercel.app</div>

        {champs.slice(0, 4).map((c, i) => (
          <div key={c.id} style={{ position: "absolute", left: 880 + (i % 2) * 330 - (i >= 2 ? 40 : 0), top: 70 + Math.floor(i / 2) * 410 + (i % 2) * 40, width: 300, height: 380, borderRadius: 26, overflow: "hidden", border: "3px solid #2dd4bf66", boxShadow: "0 30px 80px #000c", transform: `rotate(${[-4, 3, 3, -3][i]}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.splash(c.id)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }} />
            <div style={{ position: "absolute", inset: "auto 0 0 0", padding: "40px 18px 16px", background: "linear-gradient(0deg,#000d,transparent)", fontWeight: 900, fontSize: 30 }}>{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
