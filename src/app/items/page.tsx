import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getItems, getPatches, img } from "@/lib/ddragon";
import { loadRealData, MIN_CHAMP_GAMES } from "@/lib/real";
import { ddLocale } from "@/lib/i18n";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "아이템 통계" : "Item stats",
    description: ko
      ? "실제 랭크 게임에서 코어템으로 가장 많이 완성된 아이템과 승률, 많이 쓰는 챔피언."
      : "Most completed core items in real ranked games, with win rate and the champions who build them.",
  };
}

type Props = { searchParams: Promise<{ sort?: string }> };

export default async function ItemsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await getLang();
  const ko = lang === "ko";
  const sort = sp.sort === "wr" ? "wr" : "pick";
  const [{ version, champions }, patches, server] = await Promise.all([getChampions(ddLocale(lang)), getPatches().catch(() => [] as string[]), getServer()]);
  const real = loadRealData({ server, rank: "all" });
  const patch = [...patches].reverse().find((p) => real.has(p));
  const items = await getItems(version, ddLocale(lang)).catch(() => []);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const champByKey = new Map(champions.map((c) => [c.key, c]));

  // 챔피언·라인별 "n번째 코어템" 집계를 아이템 기준으로 합칩니다
  const byItem = new Map<string, { g: number; w: number; by: Map<string, number> }>();
  if (patch) {
    for (const [k, agg] of Object.entries(real.get(patch)!.champs)) {
      if (agg.games < MIN_CHAMP_GAMES) continue;
      const ck = k.split(":")[0];
      for (const [slot, [g, w]] of Object.entries(agg.slots ?? {})) {
        const id = slot.split(":")[1];
        const it = itemById.get(id);
        if (!it || it.gold.total < 2200) continue; // 신발·소품 제외, 완성템만
        const e = byItem.get(id) ?? { g: 0, w: 0, by: new Map() };
        e.g += g;
        e.w += w;
        e.by.set(ck, (e.by.get(ck) ?? 0) + g);
        byItem.set(id, e);
      }
    }
  }
  const rows = [...byItem.entries()]
    .filter(([, e]) => e.g >= 50)
    .map(([id, e]) => ({ id, name: itemById.get(id)!.name, g: e.g, wr: (e.w / e.g) * 100, top: [...e.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([ck]) => champByKey.get(ck)).filter(Boolean) }))
    .sort((a, b) => (sort === "wr" ? b.wr - a.wr : b.g - a.g))
    .slice(0, 60);

  const tab = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-accent font-semibold text-bg" : "bg-panel-2 text-muted hover:text-text"}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "아이템 통계" : "Item stats"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko ? `패치 ${patch ?? "-"} 실제 랭크 게임에서 코어템(1~4번째)으로 완성된 아이템이에요.` : `Items completed as core items (1st–4th) in real ranked games, patch ${patch ?? "-"}.`}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/items" className={tab(sort === "pick")}>{ko ? "많이 완성한 순" : "Most built"}</Link>
        <Link href="/items?sort=wr" className={tab(sort === "wr")}>{ko ? "승률 높은 순" : "Highest win rate"}</Link>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{ko ? "아직 수집된 데이터가 부족해요." : "Not enough collected data yet."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                <Icon src={img.item(version, r.id)} alt={r.name} size={36} className="rounded" />
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span className="hidden gap-1 sm:flex">
                  {r.top.map((c) => (
                    <Link key={c!.id} href={`/champions/${c!.id}`} title={c!.name}>
                      <Icon src={img.champion(version, c!.image.full)} alt={c!.name} size={28} className="rounded-full" />
                    </Link>
                  ))}
                </span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums" style={{ color: r.wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" }}>
                  {r.wr.toFixed(1)}%
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-muted">{r.g.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
