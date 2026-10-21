import { Icon } from "@/components/ui";
import { img } from "@/lib/ddragon";
import type { QuickBuild } from "@/lib/real";

// 핵심 룬 · 보조 룬 계열 · 스펠 · 코어템을 아이콘으로 한 줄에 (표와 카드에서 같이 씁니다)
export default function BuildIcons({ qb, version, size = 28 }: { qb: QuickBuild; version: string; size?: number }) {
  const small = Math.round(size * 0.7);
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-0.5">
        {qb.keystone && <Icon src={img.rune(qb.keystone.icon)} alt={qb.keystone.name} size={size} className="rounded-full bg-bg" />}
        {qb.secondary && <Icon src={img.rune(qb.secondary.icon)} alt={qb.secondary.name} size={small} />}
      </span>
      <span className="flex flex-col gap-0.5">
        {qb.spells.slice(0, 2).map((s) => (
          <Icon key={s.id} src={img.spell(version, s.image.full)} alt={s.name} size={Math.round(size / 2) - 1} />
        ))}
      </span>
      <span className="flex items-center gap-0.5">
        {qb.core.map((i) => (
          <Icon key={i.id} src={img.item(version, i.id)} alt={i.name} size={size} />
        ))}
      </span>
    </span>
  );
}
