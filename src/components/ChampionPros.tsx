// 챔피언 페이지: 이 챔피언을 최근에 한 프로·스트리머·챌린저의 실제 솔로랭크 빌드 (op.gg·probuilds 처럼)
import Link from "@/components/Link";
import { Icon, Panel } from "@/components/ui";
import { img, type Item, type RuneTree, type SummonerSpell } from "@/lib/ddragon";
import { timeAgo, type Lang } from "@/lib/i18n";
import { proBuilds } from "@/lib/pro-builds";

export default async function ChampionPros({
  champKey,
  champName,
  lane,
  lang,
  version,
  items,
  trees,
  spells,
}: {
  champKey: string;
  champName: string;
  lane: string;
  lang: Lang;
  version: string;
  items: Item[];
  trees: RuneTree[];
  spells: SummonerSpell[];
}) {
  const { list } = await proBuilds(champKey, lane, 8);
  if (!list.length) return null;
  const ko = lang === "ko";
  const itemById = new Map(items.map((i) => [i.id, i]));
  const runeById = new Map(trees.flatMap((t) => t.slots.flatMap((s) => s.runes)).map((r) => [r.id, r]));
  const spellByKey = new Map(spells.map((s) => [s.key, s]));
  return (
    <Panel title={ko ? `프로·챌린저가 최근에 간 ${champName} 빌드` : `Recent ${champName} builds from pros and challengers`}>
      <p className="mb-3 text-xs text-muted">
        {ko ? "한국·북미·유럽 프로 선수, 스트리머, 챌린저 상위권의 실제 솔로랭크 게임이에요." : "Real solo queue games from pros, streamers and top challengers on KR, NA and EUW."}
      </p>
      <ul className="space-y-1.5">
        {list.map((p) => {
          const key = runeById.get(p.runes.perks[0]);
          const [k, d, a] = p.kda;
          return (
            <li key={p.m} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-panel-2 px-3 py-2">
              <div className="w-36 min-w-0">
                {p.who ? (
                  <Link href={`/summoner?id=${encodeURIComponent(p.who)}&s=${p.s}`} className={`block truncate text-sm font-semibold hover:underline ${p.kind === "challenger" ? "" : "text-accent"}`}>
                    {p.label}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-semibold">{p.label}</span>
                )}
                <span className="block text-xs text-muted">{timeAgo(new Date(p.at).toISOString(), lang)}</span>
              </div>
              <div className="w-16 text-xs">
                <span className={p.win ? "text-win" : "text-lose"}>{p.win ? (ko ? "승리" : "Win") : ko ? "패배" : "Loss"}</span>
                <span className="block tabular-nums text-muted">{k}/{d}/{a}</span>
              </div>
              <div className="flex items-center gap-1">
                {key && <Icon src={img.rune(key.icon)} alt={key.name} size={26} className="rounded-full bg-bg" />}
                {p.spells.map((s) => {
                  const sp = spellByKey.get(String(s));
                  return sp ? <Icon key={s} src={img.spell(version, sp.image.full)} alt={sp.name} size={20} /> : null;
                })}
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-1">
                {p.core.map((id, i) => (
                  <span key={id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-muted">›</span>}
                    <Icon src={img.item(version, id)} alt={itemById.get(id)?.name ?? id} size={30} />
                  </span>
                ))}
                {p.boots && <Icon src={img.item(version, p.boots)} alt={itemById.get(p.boots)?.name ?? ""} size={26} className="ml-2 opacity-90" />}
              </div>
            </li>
          );
        })}
      </ul>
      <Link href="/pros" className="mt-3 block text-xs text-accent hover:underline">
        {ko ? "프로 라이브 전체 보기 →" : "See all pro games →"}
      </Link>
    </Panel>
  );
}
