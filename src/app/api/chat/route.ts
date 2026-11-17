import { getChampions, type Champion } from "@/lib/ddragon";
import { LANES, laneLabel, type Lane } from "@/lib/lanes";
import { latest, rows } from "@/lib/counters";
import { realLanes } from "@/lib/real";
import { SITE } from "@/lib/site";

// 방송 채팅 명령어용 한 줄 답 (Nightbot $(urlfetch), StreamElements $(customapi) 등).
// 스트리머가 !상성 야스오 요네, !카운터 아리 같은 명령어를 달면 채팅에 승률과 사이트 주소가 같이 찍혀요.
// 다른 통계 사이트(aoe2insights)가 이 방식으로 방송 시청자에게 알려졌어요. 수집해 둔 데이터만 읽고 Riot 호출은 없어요.
//   /api/chat?q=yasuo yone        → 상성
//   /api/chat?q=counter ahri      → 카운터 3명
//   &lang=ko  &s=kr|na|euw  (기본: 영어, 한국 서버)
const SERVER = { kr: "kr", na: "na1", na1: "na1", euw: "euw1", euw1: "euw1" } as const;
const LANE_WORD: Record<string, Lane> = { top: "top", jungle: "jungle", jg: "jungle", mid: "mid", middle: "mid", bottom: "bottom", bot: "bottom", adc: "bottom", support: "support", sup: "support", 탑: "top", 정글: "jungle", 미드: "mid", 원딜: "bottom", 바텀: "bottom", 서폿: "support", 서포터: "support" };
const slug = (v: string) => v.toLowerCase().replace(/[\s'.&_-]/g, "");
const text = (body: string, status = 200) =>
  new Response(body.slice(0, 380), { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=600", "x-robots-tag": "noindex" } });

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ko = sp.get("lang") === "ko";
  const server = SERVER[(sp.get("s") ?? "kr").toLowerCase() as keyof typeof SERVER] ?? "kr";
  const host = SITE.replace(/^https?:\/\//, "");
  const usage = ko ? `사용법: 챔피언 두 명(상성) 또는 "카운터 챔피언". 예: 야스오 요네 · ${host}` : `Usage: two champions (matchup) or "counter <champion>". e.g. yasuo yone · ${host}`;
  const words = (sp.get("q") ?? "").trim().slice(0, 80).split(/[\s,+/]+/).filter(Boolean);
  if (!words.length) return text(usage);
  try {
    const [{ champions }, { champions: en }] = await Promise.all([getChampions(ko ? "ko_KR" : "en_US"), getChampions("en_US")]);
    const bySlug = new Map<string, Champion>();
    champions.forEach((c, i) => {
      bySlug.set(slug(c.name), c);
      bySlug.set(slug(c.id), c);
      if (en[i]) bySlug.set(slug(en[i].name), champions.find((x) => x.id === en[i].id) ?? c);
    });
    let counter = false;
    let lane: Lane | undefined;
    const found: Champion[] = [];
    // 이름이 두 단어일 수 있어서(리 신, Lee Sin) 두 단어를 먼저 붙여 봐요
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      if (/^(vs|대|v)$/.test(w)) continue;
      if (/^(counters?|카운터)$/.test(w)) { counter = true; continue; }
      const two = i + 1 < words.length ? bySlug.get(slug(words[i] + words[i + 1])) : undefined;
      if (two) { found.push(two); i++; continue; }
      const one = bySlug.get(slug(words[i]));
      if (one) { found.push(one); continue; }
      if (LANE_WORD[w]) lane = LANE_WORD[w];
    }
    const data = latest(server);
    if (!found.length || !data) return text(usage);
    const A = found[0];
    const pct = (n: number) => n.toFixed(1);
    if (counter || found.length === 1) {
      const l = lane ?? realLanes(data, A)[0];
      const r = l ? rows(data, A, l, champions) : null;
      if (!r || !r.counters.length) return text(ko ? `${A.name}: 아직 표본이 부족해요 · ${host}` : `${A.name}: not enough games yet · ${host}`);
      const list = r.counters.slice(0, 3).map((x) => `${x.champion.name} ${pct(100 - x.winRate)}%`).join(", ");
      return text(
        ko
          ? `${A.name} ${laneLabel(l!, "ko")} 카운터: ${list} (상대 승률) · ${host}/counter/${A.id.toLowerCase()}`
          : `${A.name} ${laneLabel(l!, "en")} counters: ${list} (their win rate) · ${host}/counter/${A.id.toLowerCase()}`,
      );
    }
    const B = found[1];
    let best: Lane | undefined = lane;
    let g = 0;
    let w = 0;
    for (const l of lane ? [{ id: lane }] : LANES) {
      const [vg, vw] = data.champs[`${A.key}:${l.id}`]?.vs[B.key] ?? [0, 0];
      if (vg > g) [g, w, best] = [vg, vw, l.id];
    }
    const link = `${host}/${A.id.toLowerCase()}-vs-${B.id.toLowerCase()}`;
    if (g < 5 || !best) return text(ko ? `${A.name} vs ${B.name}: 아직 표본이 부족해요 · ${link}` : `${A.name} vs ${B.name}: not enough games yet · ${link}`);
    return text(
      ko
        ? `${laneLabel(best, "ko")} ${A.name} vs ${B.name}: ${A.name} 승률 ${pct((w / g) * 100)}% (${g.toLocaleString("en-US")}게임) · ${link}`
        : `${A.name} vs ${B.name} (${laneLabel(best, "en")}): ${A.name} wins ${pct((w / g) * 100)}% of ${g.toLocaleString("en-US")} games · ${link}`,
    );
  } catch (e) {
    if (process.env.CHAT_DEBUG) return text(String((e as Error)?.stack));
    return text(usage);
  }
}
