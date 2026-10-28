import type { Metadata } from "next";
import ChampionSearch from "@/components/ChampionSearch";
import { Panel } from "@/components/ui";
import { getChampions, img, type Champion } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const revalidate = 3600;

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
  const other = lang === "ko" ? "en_US" : "ko_KR";
  const [{ version, champions }, { champions: alt }] = await Promise.all([getChampions(ddLocale(lang)), getChampions(other).catch(() => ({ champions: [] as Champion[] }))]);
  const altName = new Map(alt.map((c) => [c.id, c.name]));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{lang === "ko" ? "챔피언 목록" : "All champions"}</h1>
      <Panel>
        <ChampionSearch
          lang={lang}
          champions={champions.map((c) => ({ id: c.id, name: c.name, alt: altName.get(c.id), icon: img.champion(version, c.image.full) }))}
        />
      </Panel>
    </div>
  );
}
