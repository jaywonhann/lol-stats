import type { Metadata } from "next";
import ChampionSearch from "@/components/ChampionSearch";
import { Panel } from "@/components/ui";
import { getChampions, getPatches, img, type Champion } from "@/lib/ddragon";
import { LANES } from "@/lib/lanes";
import { MIN_CHAMP_GAMES } from "@/lib/real";
import { statsSource } from "@/lib/stats";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer, langAlternates } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "롤 챔피언 카운터 - 상대 챔피언 고르기" : "LoL Counter Picks - Every Champion's Counters",
    description: ko
      ? "상대 챔피언을 고르면 그 챔피언을 잘 잡는 카운터와 승률을 이번 패치 실제 랭크 게임 기준으로 보여드려요."
      : "Pick the enemy champion to see who counters it, with real ranked win rates from this patch.",
    alternates: await langAlternates("/counters"),
  };
}

export default async function CountersIndex() {
  const lang = await getLang();
  const server = await getServer();
  const other = lang === "ko" ? "en_US" : "ko_KR";
  const [{ version, champions }, { champions: alt }] = await Promise.all([getChampions(ddLocale(lang)), getChampions(other).catch(() => ({ champions: [] as Champion[] }))]);
  // 현재 서버의 최신 패치 전체 승률 (실제 수집 데이터가 있을 때만, 표본이 적은 챔피언은 숨김)
  const src = statsSource(await getPatches().catch(() => [] as string[]), { server, rank: "all" });
  const latest = src.source === "real" ? src.real.get(src.patches[src.patches.length - 1]) : undefined;
  const winOf = (key: string) => {
    let g = 0;
    let w = 0;
    for (const l of LANES) {
      const c = latest?.champs[`${key}:${l.id}`];
      if (c) {
        g += c.games;
        w += c.wins;
      }
    }
    return g >= MIN_CHAMP_GAMES ? (w / g) * 100 : undefined;
  };
  // 가장 많이 플레이된 라인: 목록에서 눌렀을 때 바로 그 라인 페이지로 가요
  const mainLane = (key: string) => {
    let best: { id: string; g: number } | undefined;
    for (const l of LANES) {
      const g = latest?.champs[`${key}:${l.id}`]?.games ?? 0;
      if (g >= MIN_CHAMP_GAMES && (!best || g > best.g)) best = { id: l.id, g };
    }
    return best?.id;
  };
  const altName = new Map(alt.map((c) => [c.id, c.name]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{lang === "ko" ? "챔피언 카운터" : "Counter picks"}</h1>
        <p className="mt-1 text-sm text-muted">{lang === "ko" ? "상대 챔피언을 고르면 그 챔피언을 잘 잡는 챔피언과 승률을 보여드려요." : "Pick the enemy champion to see who beats it and by how much."}</p>
      </div>
      <Panel>
        <ChampionSearch
          lang={lang}
          filters
          suffix="/counters"
          champions={champions.map((c) => ({ id: c.id, name: c.name, alt: altName.get(c.id), icon: img.champion(version, c.image.full), tags: c.tags, wr: winOf(c.key), lane: mainLane(c.key) }))}
        />
      </Panel>
    </div>
  );
}
