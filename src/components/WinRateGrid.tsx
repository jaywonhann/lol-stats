import { WinRateBars } from "@/components/charts";
import { Icon } from "@/components/ui";
import { img } from "@/lib/ddragon";
import { dict, type Lang } from "@/lib/i18n";
import type { realWinRates } from "@/lib/real";

// 이 챔피언의 룬·템트리·신발·스펠 승률 막대 그래프 (챔피언 화면과 윈도우 앱 화면에서 같이 씁니다)
export default function WinRateGrid({ wr, version, lang }: { wr: ReturnType<typeof realWinRates>; version: string; lang: Lang }) {
  const t = dict(lang);
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <WinRateBars
        title={t.keystoneSecondary}
        lang={lang}
        rows={wr.runes.map((r) => ({
          key: `${r.value.keystone.id}-${r.value.secondary.id}`,
          name: `${r.value.keystone.name} + ${r.value.secondary.name}`,
          winRate: r.winRate,
          games: r.games,
          label: (
            <>
              <Icon src={img.rune(r.value.keystone.icon)} alt={r.value.keystone.name} size={28} className="rounded-full bg-bg" />
              <Icon src={img.rune(r.value.secondary.icon)} alt={r.value.secondary.name} size={18} />
              <span className="truncate text-xs">{r.value.keystone.name}</span>
            </>
          ),
        }))}
      />
      <WinRateBars
        title={t.summonerSpells}
        lang={lang}
        rows={wr.spells.map((r) => ({
          key: r.value.map((s) => s.id).join("-"),
          name: r.value.map((s) => s.name).join(" + "),
          winRate: r.winRate,
          games: r.games,
          label: r.value.map((s) => <Icon key={s.id} src={img.spell(version, s.image.full)} alt={s.name} size={28} />),
        }))}
      />
      <WinRateBars
        title={t.coreFirstTwo}
        lang={lang}
        rows={wr.core.map((r) => ({
          key: r.value.map((i) => i.id).join("-"),
          name: r.value.map((i) => i.name).join(" › "),
          winRate: r.winRate,
          games: r.games,
          label: r.value.map((item, j) => (
            <span key={item.id} className="flex items-center gap-1">
              {j > 0 && <span className="text-muted">›</span>}
              <Icon src={img.item(version, item.id)} alt={item.name} size={28} />
            </span>
          )),
        }))}
      />
      <WinRateBars
        title={t.boots}
        lang={lang}
        rows={wr.boots.map((r) => ({
          key: r.value.id,
          name: r.value.name,
          winRate: r.winRate,
          games: r.games,
          label: (
            <>
              <Icon src={img.item(version, r.value.id)} alt={r.value.name} size={28} />
              <span className="truncate text-xs">{r.value.name}</span>
            </>
          ),
        }))}
      />
    </div>
  );
}
