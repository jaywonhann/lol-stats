import type { Metadata } from "next";
import Link from "next/link";
import ApplyButtons from "@/components/ApplyButtons";
import ChampionSearch from "@/components/ChampionSearch";
import { Icon, Panel, Tabs, WinRate, pct } from "@/components/ui";
import {
  getChampion,
  getChampions,
  getItems,
  getPatches,
  getRuneTrees,
  getSummonerSpells,
  img,
} from "@/lib/ddragon";
import { ddLocale, dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import { LANES, laneLabel, type Lane } from "@/lib/lanes";
import { proBuilds, type ProBuild } from "@/lib/pro-builds";
import { realBuild, realChamp, realCorePath, realShards } from "@/lib/real";
import { getLang, getServer } from "@/lib/server";
import { boards, lanesOf } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLang()).nav.app };
}

type Props = { searchParams: Promise<{ champ?: string; lane?: string }> };

// 윈도우 앱이 띄우는 화면: 고정 추천 빌드를 먼저, 그 아래 프로·챌린저 최근 빌드
export default async function AppPage({ searchParams }: Props) {
  const [sp, lang, server] = await Promise.all([searchParams, getLang(), getServer()]);
  const t = dict(lang);
  const loc = ddLocale(lang);
  const { version, champions } = await getChampions(loc);
  // 앱은 숫자 ID(championId)로, 사이트는 영문 키로 넘겨요
  const champ = champions.find((c) => c.key === sp.champ || c.id.toLowerCase() === sp.champ?.toLowerCase());

  if (!champ) {
    return (
      <Panel title={t.app.pickTitle}>
        <p className="mb-3 text-sm text-muted">{t.app.pickHint}</p>
        <ChampionSearch
          lang={lang}
          base="/app?champ="
          champions={champions.map((c) => ({ id: c.id, name: c.name, icon: img.champion(version, c.image.full) }))}
        />
      </Panel>
    );
  }

  const [detail, patches, items, trees, spells] = await Promise.all([
    getChampion(champ.id, loc),
    getPatches(),
    getItems(version, loc),
    getRuneTrees(version, loc),
    getSummonerSpells(version, loc),
  ]);
  const filter = { server, rank: "all" as const };
  const lanes = lanesOf(champ, patches, filter);
  const lane: Lane = lanes.includes(sp.lane as Lane) ? (sp.lane as Lane) : lanes[0];
  const { source, patches: statPatches, real } = boards(champions, lane, filter, patches);
  const patch = statPatches[statPatches.length - 1];
  const agg = source === "real" ? realChamp(real.get(patch)!, champ, lane) : null;
  const b = agg ? realBuild(agg, items, trees, spells) : null;
  const cp = agg ? realCorePath(agg, items) : null;
  const fixed = cp?.builds[0] ?? null;
  const pros = await proBuilds(champ.key, lane);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const runeById = new Map(trees.flatMap((tr) => [[tr.id, { name: tr.name, icon: tr.icon }] as const, ...tr.slots.flatMap((s) => s.runes.map((r) => [r.id, r] as const))]));
  const spellByKey = new Map(spells.map((s) => [s.key, s]));
  const rune = b?.runes[0]?.value;
  const nl = numLocale(lang);
  const recommended = new Set(fixed?.value.map((i) => i.id) ?? []);
  // 룬 적용에는 능력치 파편까지 9개가 필요해요. 파편 데이터가 아직 없으면 버튼을 막아 둡니다
  const shards = agg ? realShards(agg) : null;
  const runePayload =
    rune && shards
      ? {
          name: champ.name,
          primaryStyleId: rune.primary.id,
          subStyleId: rune.secondary.id,
          selectedPerkIds: [rune.keystone, ...rune.primaryRunes, ...rune.secondaryRunes, ...shards],
        }
      : null;
  // 점멸은 F(두 번째 칸)에 둡니다
  const spellKeys = b?.spells[0]?.value.map((x) => Number(x.key)) ?? null;
  const spellPayload =
    spellKeys?.length === 2 && spellKeys.every(Number.isFinite)
      ? spellKeys[0] === 4
        ? [spellKeys[1], spellKeys[0]]
        : spellKeys
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon src={img.champion(version, champ.image.full)} alt={champ.name} size={56} className="rounded-lg" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">{champ.name}</h1>
          <Link href="/app" className="text-xs text-muted hover:text-text">
            ← {t.app.allChamps}
          </Link>
        </div>
        <Tabs
          active={lane}
          items={LANES.filter((l) => lanes.includes(l.id)).map((l) => ({
            id: l.id,
            label: laneLabel(l.id, lang),
            href: `/app?champ=${champ.key}&lane=${l.id}`,
          }))}
        />
      </div>

      <ApplyButtons lang={lang} runes={runePayload} spells={spellPayload} />

      <Panel title={t.app.fixedTitle}>
        {!b || !fixed ? (
          <p className="text-sm text-muted">{t.app.noData}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted">{t.app.fixedNote(agg!.games.toLocaleString(nl))}</p>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">{t.app.fixedCore}</p>
              <div className="flex flex-wrap items-center gap-2">
                {fixed.value.map((item, i) => (
                  <span key={item.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-muted">›</span>}
                    <span className="relative">
                      <Icon src={img.item(version, item.id)} alt={item.name} size={48} className="ring-2 ring-accent" />
                      <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">{i + 1}</span>
                    </span>
                  </span>
                ))}
                {b.boots[0] && (
                  <span className="ml-2 flex items-center gap-2 border-l border-line pl-3">
                    <Icon src={img.item(version, b.boots[0].value.id)} alt={b.boots[0].value.name} size={40} />
                  </span>
                )}
                <span className="ml-auto text-right text-xs">
                  <WinRate value={fixed.winRate} />
                  <span className="block text-muted">{t.pickRate} {pct(fixed.pickRate)}</span>
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t.app.keystone}</p>
                {rune && (
                  <div className="flex items-center gap-1">
                    {[rune.keystone, ...rune.primaryRunes].map((id, i) => {
                      const r = runeById.get(id);
                      return r ? <Icon key={id} src={img.rune(r.icon)} alt={r.name} size={i ? 26 : 36} className="rounded-full bg-bg" /> : null;
                    })}
                    <Icon src={img.rune(rune.secondary.icon)} alt={rune.secondary.name} size={22} className="ml-1 opacity-80" />
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t.summonerSpells}</p>
                <div className="flex gap-1">
                  {b.spells[0]?.value.map((s) => <Icon key={s.id} src={img.spell(version, s.image.full)} alt={s.name} size={32} />)}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t.skillOrder}</p>
                <div className="flex items-center gap-1">
                  {b.skillOrder[0]?.value.map((k, j) => {
                    const s = detail?.champion.spells["QWE".indexOf(k)];
                    return (
                      <span key={k} className="flex items-center gap-1">
                        {j > 0 && <span className="text-muted">›</span>}
                        <span className="relative">
                          {s && <Icon src={img.spell(version, s.image.full)} alt={s.name} size={30} />}
                          <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[10px] font-bold">{k}</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            {b.starters[0] && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t.app.startItems}</p>
                <div className="flex gap-1">
                  {b.starters[0].value.map((item, i) => <Icon key={i} src={img.item(version, item.id)} alt={item.name} size={30} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title={t.app.proTitle}>
        <p className="mb-1 text-xs text-muted">{t.app.proNote}</p>
        <p className="mb-3 text-xs text-muted"><mark className="rounded bg-yellow-300/40 px-1 text-text">abc</mark> {t.app.hlLegend}</p>
        {pros.list.length === 0 ? (
          <p className="text-sm text-muted">{t.app.proEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {pros.list.map((p) => (
              <ProRow key={p.m} p={p} recommended={recommended} lang={lang} version={version} itemById={itemById} runeById={runeById} spellByKey={spellByKey} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ProRow({
  p,
  recommended,
  lang,
  version,
  itemById,
  runeById,
  spellByKey,
}: {
  p: ProBuild;
  recommended: Set<string>;
  lang: Lang;
  version: string;
  itemById: Map<string, { name: string }>;
  runeById: Map<number, { name: string; icon: string }>;
  spellByKey: Map<string, { name: string; image: { full: string } }>;
}) {
  const t = dict(lang);
  const key = runeById.get(p.runes.perks[0]);
  const [k, d, a] = p.kda;
  const name = p.label.replace(/ \(.*\)$/, "");
  const initials = name.slice(0, 2).toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const compared = recommended.size ? p.core.slice(0, recommended.size) : [];
  const same = compared.filter((id) => recommended.has(id)).length;
  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-md border-l-4 bg-panel-2 px-3 py-2 ${p.win ? "border-sky-500" : "border-rose-500"}`}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: `hsl(${hue} 45% 38%)` }}
        aria-hidden
      >
        {initials}
      </span>
      <div className="w-32 min-w-0">
        <p className={`truncate text-sm font-semibold ${p.kind === "challenger" ? "" : "text-accent"}`}>{p.label}</p>
        <p className="truncate text-[11px] text-muted">
          {p.kind === "pro" ? (
            <a
              href={`https://lol.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text hover:underline"
            >
              {t.app.profile} ↗
            </a>
          ) : (
            p.who
          )}
        </p>
      </div>
      <div className="w-20 text-xs">
        <span className={p.win ? "text-sky-400" : "text-rose-400"}>{p.win ? t.app.win : t.app.loss}</span>
        <span className="block text-muted">{k}/{d}/{a}</span>
      </div>
      <div className="flex items-center gap-1">
        {key && <Icon src={img.rune(key.icon)} alt={key.name} size={28} className="rounded-full bg-bg" />}
        {p.spells.map((s) => {
          const sp = spellByKey.get(String(s));
          return sp ? <Icon key={s} src={img.spell(version, sp.image.full)} alt={sp.name} size={22} /> : null;
        })}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {p.core.map((id, i) => {
          const it = itemById.get(id);
          return (
            <span key={id} className="flex items-center gap-1">
              {i > 0 && <span className="text-xs text-muted">›</span>}
              {/* 추천 빌드에 없는 아이템은 형광펜으로 칠해서 보여줘요 */}
              <span className={`rounded p-0.5 ${recommended.size && !recommended.has(id) && i < recommended.size ? "bg-yellow-300/50" : ""}`}>
                <Icon src={img.item(version, id)} alt={it?.name ?? id} size={32} />
              </span>
            </span>
          );
        })}
        {p.boots && <Icon src={img.item(version, p.boots)} alt={itemById.get(p.boots)?.name ?? ""} size={28} className="ml-2 opacity-90" />}
      </div>
      <span className="text-right text-[11px] text-muted">
        {compared.length > 0 && <span className="block font-semibold text-text">{t.app.hlSame(same, compared.length)}</span>}
        {timeAgo(new Date(p.at).toISOString(), lang)}
      </span>
    </li>
  );
}
