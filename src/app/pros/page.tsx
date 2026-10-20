import type { Metadata } from "next";
import ProsLive from "@/components/ProsLive";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "ko" ? "지금 프로 게임" : "Pros in game" };
}

export default async function ProsPage() {
  const lang = await getLang();
  const ko = lang === "ko";
  const { version, champions } = await getChampions(ddLocale(lang));
  const champs = Object.fromEntries(
    champions.map((c) => [c.key, { name: c.name, id: c.id, icon: img.champion(version, c.image.full) }]),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ko ? "지금 프로가 하는 게임" : "Pros in game right now"}</h1>
      <p className="text-sm text-muted">
        {ko
          ? "프로 선수와 스트리머, 챌린저 계정 중 지금 게임 중인 사람이에요. 이름을 누르면 최근 전적을 볼 수 있어요."
          : "Pro players, streamers and Challengers who are in a game now. Tap a name to see recent games."}
      </p>
      <ProsLive champs={champs} ko={ko} />
    </div>
  );
}
