import { Icon } from "@/components/ui";
import { img } from "@/lib/ddragon";
import type { RuneTree, SummonerSpell } from "@/lib/ddragon";
import { dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import type { liveChampionBuild } from "@/lib/live-history";

type Live = Awaited<ReturnType<typeof liveChampionBuild>>;
type Row = { key: string; label: React.ReactNode; n: number };

// 사용 비율 막대 (승률이 아니라 "지금 몇 명이 쓰는지"라서 한 가지 색으로만 그려요)
function UsageBars({ title, rows, total, lang }: { title: string; rows: Row[]; total: number; lang: Lang }) {
  const nl = numLocale(lang);
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-muted">{title}</figcaption>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const share = (r.n / total) * 100;
          return (
            <div key={r.key} className="grid grid-cols-[minmax(0,8rem)_1fr_3.5rem] items-center gap-2">
              <span className="flex min-w-0 items-center gap-1">{r.label}</span>
              <span className="h-3 rounded-sm bg-panel-2" aria-hidden>
                <span className="block h-3 rounded-sm bg-accent" style={{ width: `${Math.max(share, 3)}%` }} />
              </span>
              <span className="text-right text-xs tabular-nums">
                {share.toLocaleString(nl, { maximumFractionDigits: 0 })}% <span className="text-muted">({r.n})</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// 지금 진행 중인 랭크 게임 표본에서 이 챔피언의 룬·스펠 사용 현황
export default function LiveBuild({
  live,
  champName,
  trees,
  spells,
  version,
  lang,
}: {
  live: Live;
  champName: string;
  trees: RuneTree[];
  spells: SummonerSpell[];
  version: string;
  lang: Lang;
}) {
  const t = dict(lang).app;
  const runeById = new Map(trees.flatMap((tr) => tr.slots.flatMap((s) => s.runes)).map((r) => [r.id, r]));
  const treeById = new Map(trees.map((tr) => [tr.id, tr]));
  const spellByKey = new Map(spells.map((s) => [s.key, s]));
  const total = live.players;

  const keystones: Row[] = live.keystones.flatMap((k) => {
    const r = runeById.get(Number(k.key));
    return r
      ? [{ key: k.key, n: k.n, label: (<><Icon src={img.rune(r.icon)} alt={r.name} size={24} className="rounded-full bg-bg" /><span className="truncate text-xs">{r.name}</span></>) }]
      : [];
  }).slice(0, 5);
  const secondaries: Row[] = live.secondaries.flatMap((k) => {
    const tr = treeById.get(Number(k.key));
    return tr
      ? [{ key: k.key, n: k.n, label: (<><Icon src={img.rune(tr.icon)} alt={tr.name} size={22} /><span className="truncate text-xs">{tr.name}</span></>) }]
      : [];
  }).slice(0, 4);
  const spellRows: Row[] = live.spells.flatMap((k) => {
    const pair = k.key.split(",").map((id) => spellByKey.get(id));
    return pair.length === 2 && pair.every(Boolean)
      ? [{ key: k.key, n: k.n, label: (<>{pair.map((sp) => (<Icon key={sp!.id} src={img.spell(version, sp!.image.full)} alt={sp!.name} size={24} />))}</>) }]
      : [];
  }).slice(0, 4);

  return (
    <div>
      {total < 3 ? (
        <p className="text-sm text-muted">{t.liveFew}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted" aria-label={t.liveTitle(champName)}>
            {t.liveNote(total, live.updatedAt ? timeAgo(live.updatedAt, lang, { minutes: true }) : null)}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <UsageBars title={t.liveKeystone} rows={keystones} total={total} lang={lang} />
            <UsageBars title={t.liveSecondary} rows={secondaries} total={total} lang={lang} />
            <UsageBars title={dict(lang).summonerSpells} rows={spellRows} total={total} lang={lang} />
          </div>
        </>
      )}
    </div>
  );
}
