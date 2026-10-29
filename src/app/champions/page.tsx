import type { Metadata } from "next";
import ChampionSearch from "@/components/ChampionSearch";
import { Panel } from "@/components/ui";
import { getChampions, getPatches, img, type Champion } from "@/lib/ddragon";
import { LANES } from "@/lib/lanes";
import { MIN_CHAMP_GAMES } from "@/lib/real";
import { statsSource } from "@/lib/stats";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "챔피언 목록" : "All champions",
    description: ko
      ? "모든 챔피언의 룬, 아이템, 상성을 한 곳에서 찾아보세요. 이름으로 바로 검색할 수 있어요."
      : "Browse every League of Legends champion and jump to runes, builds and matchups. Search by name.",
  };
}

export default async function ChampionsIndex() {
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
  const altName = new Map(alt.map((c) => [c.id, c.name]));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{lang === "ko" ? "챔피언 목록" : "All champions"}</h1>
      <Panel>
        <ChampionSearch
          lang={lang}
          filters
          champions={champions.map((c) => ({ id: c.id, name: c.name, alt: altName.get(c.id), icon: img.champion(version, c.image.full), tags: c.tags, wr: winOf(c.key) }))}
        />
      </Panel>
    </div>
  );
}
