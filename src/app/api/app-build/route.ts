import { NextResponse } from "next/server";
import { applyPayloads } from "@/lib/app-build";
import { getChampions, getItems, getPatches, getRuneTrees, getSummonerSpells } from "@/lib/ddragon";
import { LANES, parseServer, type Lane } from "@/lib/lanes";
import { realBuild, realChamp } from "@/lib/real";
import { boards, lanesOf } from "@/lib/stats";
import { parseLang, ddLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// 윈도우 앱이 챔피언을 확정했을 때 부르는 곳: 그 챔피언·라인의 추천 룬과 스펠을 돌려줘요
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const server = parseServer(q.get("server") ?? undefined);
  const loc = ddLocale(parseLang(q.get("lang") ?? undefined));
  const { version, champions } = await getChampions(loc);
  const champ = champions.find((c) => c.key === q.get("champ"));
  if (!champ) return NextResponse.json({ ok: false, reason: "unknown-champion" }, { status: 404 });

  const [patches, items, trees, spells] = await Promise.all([
    getPatches(),
    getItems(version, loc),
    getRuneTrees(version, loc),
    getSummonerSpells(version, loc),
  ]);
  const filter = { server, rank: "all" as const };
  const lanes = lanesOf(champ, patches, filter);
  const asked = LANES.find((l) => l.id === q.get("lane"))?.id as Lane | undefined;
  const lane: Lane = asked && lanes.includes(asked) ? asked : lanes[0];
  const { source, patches: statPatches, real } = boards(champions, lane, filter, patches);
  const agg = source === "real" ? realChamp(real.get(statPatches[statPatches.length - 1])!, champ, lane) : null;
  if (!agg) return NextResponse.json({ ok: false, reason: "no-data" });
  const out = applyPayloads(agg, realBuild(agg, items, trees, spells), champ.name);
  return NextResponse.json({ ok: true, lane, ...out }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
