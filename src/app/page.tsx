import Link from "next/link";
import ChampionSearch from "@/components/ChampionSearch";
import { Icon, Panel, TierBadge, WinRate } from "@/components/ui";
import { getChampions, img, patchLabel } from "@/lib/ddragon";
import { LANES } from "@/lib/lanes";
import { tierList } from "@/lib/mock";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { version, champions } = await getChampions();
  const patch = patchLabel(version);

  return (
    <div className="space-y-8">
      <section className="pt-4 text-center">
        <h1 className="text-3xl font-bold">
          <span className="text-accent">협곡</span>지표
        </h1>
        <p className="mt-2 text-sm text-muted">패치 {patch} 기준 챔피언 티어, 빌드, 룬, 카운터</p>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        {LANES.map((lane) => (
          <Panel key={lane.id} title={`${lane.label} 추천 챔피언`}>
            <ul className="space-y-2">
              {tierList(champions, lane.id, "emerald", patch)
                .slice(0, 5)
                .map((s) => (
                  <li key={s.champion.id}>
                    <Link href={`/champions/${s.champion.id}?lane=${lane.id}`} className="flex items-center gap-2 hover:text-accent">
                      <Icon src={img.champion(version, s.champion.image.full)} alt={s.champion.name} size={28} />
                      <span className="flex-1 truncate text-sm">{s.champion.name}</span>
                      <TierBadge tier={s.tier} />
                    </Link>
                    <div className="pl-9 text-xs text-muted">
                      승률 <WinRate value={s.winRate} />
                    </div>
                  </li>
                ))}
            </ul>
            <Link href={`/tier?lane=${lane.id}`} className="mt-3 block text-xs text-accent hover:underline">
              전체 보기
            </Link>
          </Panel>
        ))}
      </div>

      <Panel title="챔피언 검색">
        <ChampionSearch
          champions={champions.map((c) => ({ id: c.id, name: c.name, icon: img.champion(version, c.image.full) }))}
        />
      </Panel>
    </div>
  );
}
