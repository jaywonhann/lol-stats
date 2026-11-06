import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getItems, getRuneTrees, getSummonerSpells, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang, langAlternates } from "@/lib/server";
import { ARAM_MODES, loadAram, loadAugments, MIN_ARAM_GAMES, modeName, parseMode, ranked, rankedLow, type Row } from "@/lib/aram";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> };

async function findChamp(id: string, lang: "ko" | "en") {
  const { version, champions } = await getChampions(ddLocale(lang));
  const champ = champions.find((c) => c.id.toLowerCase() === id.toLowerCase());
  return { version, champ, champions };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, sp, lang] = await Promise.all([params, searchParams, getLang()]);
  const ko = lang === "ko";
  const mode = parseMode(sp.mode, !!loadAram().matches.mayhem);
  const { champ } = await findChamp(id, lang);
  if (!champ) return {};
  const name = modeName(mode, ko);
  return {
    title: ko
      ? `${champ.name} ${mode === "mayhem" ? "증바람 템트리 · 증강 추천" : "칼바람 템트리 · 룬"}`
      : `${champ.name} ${name} build${mode === "mayhem" ? " and augments" : ""}`,
    description: ko
      ? `실제 ${name} 게임으로 집계한 ${champ.name} 승률 높은 템트리${mode === "mayhem" ? ", 증강" : ""}, 신발, 룬, 스펠.`
      : `${champ.name} best items${mode === "mayhem" ? ", augments" : ""}, boots, runes and spells from real ${name} games.`,
    alternates: await langAlternates(`/aram/${champ.id}?mode=${mode}`),
    openGraph: { images: [{ url: `/api/aram-card?id=${champ.id}&mode=${mode}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [`/api/aram-card?id=${champ.id}&mode=${mode}`] },
  };
}

const wrColor = (wr: number) => ({ color: wr >= 50 ? "var(--chart-up)" : "var(--chart-down)" });

function Stat({ row, ko }: { row: Row; ko: boolean }) {
  return (
    <span className="ml-auto flex shrink-0 items-baseline gap-2 text-right tabular-nums">
      <span className="text-sm font-semibold" style={wrColor(row.winRate)}>{row.winRate.toFixed(1)}%</span>
      <span className="w-14 text-xs text-muted">{row.games.toLocaleString()}{ko ? "판" : ""}</span>
    </span>
  );
}

export default async function AramChampPage({ params, searchParams }: Props) {
  const [{ id }, sp, lang] = await Promise.all([params, searchParams, getLang()]);
  const ko = lang === "ko";
  const data = loadAram();
  const mode = parseMode(sp.mode, !!data.matches.mayhem);
  const { version, champ, champions } = await findChamp(id, lang);
  if (!champ) notFound();
  const champByKey = new Map(champions.map((c) => [c.key, c]));
  const [items, trees, spells] = await Promise.all([
    getItems(version, ddLocale(lang)).catch(() => []),
    getRuneTrees(version, ddLocale(lang)).catch(() => []),
    getSummonerSpells(version, ddLocale(lang)).catch(() => []),
  ]);
  const augMeta = loadAugments();
  const a = data.champs[`${mode}:${champ.key}`];
  const enough = a && a.games >= MIN_ARAM_GAMES;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const runeById = new Map(trees.flatMap((t) => [[t.id, { name: t.name, icon: t.icon }] as const, ...t.slots.flatMap((s) => s.runes.map((r) => [r.id, { name: r.name, icon: r.icon }] as const))]));
  const spellByKey = new Map(spells.map((s) => [s.key, s]));
  const base = enough ? (a.wins / a.games) * 100 : 50;
  const min = enough ? Math.max(3, Math.round(a.games * 0.03)) : 3;

  const builds = enough ? ranked(a.builds, a.games, base, Math.max(5, Math.round(a.games * 0.05)), 4) : [];
  const topItems = enough ? ranked(a.items, a.games, base, min, 8, "pick") : [];
  const boots = enough ? ranked(a.boots, a.games, base, min, 3, "pick") : [];
  const augBest = enough ? ranked(a.augments, a.games, base, Math.max(3, Math.round(a.games * 0.02)), 8) : [];
  const augPick = enough ? ranked(a.augments, a.games, base, 1, 8, "pick") : [];
  const augSets = enough ? ranked(a.augSets, a.games, base, 3, 4) : [];
  const spellRows = enough ? ranked(a.spells, a.games, base, min, 2, "pick") : [];
  const pairMin = enough ? Math.max(5, Math.round(a.games * 0.03)) : 5;
  const allies = enough && a.with ? ranked(a.with, a.games, base, pairMin, 5) : [];
  const hard = enough && a.vs ? rankedLow(a.vs, a.games, base, pairMin, 5) : [];
  const runeRows = enough ? ranked(a.runes, a.games, base, min, 2, "pick") : [];

  const ItemIcon = ({ id: iid, size = 36 }: { id: string; size?: number }) => {
    const it = itemById.get(iid);
    return <Icon src={img.item(version, iid)} alt={it?.name ?? iid} size={size} />;
  };
  const Aug = ({ aid }: { aid: string }) => {
    const m = augMeta[aid];
    const name = (ko ? m?.ko : m?.en) ?? m?.en ?? (ko ? `증강 ${aid}` : `Augment ${aid}`);
    return (
      <span className="flex min-w-0 items-center gap-2">
        {m?.icon ? <Icon src={m.icon} alt={name} size={32} className="rounded-md bg-panel-2" /> : <span className="h-8 w-8 shrink-0 rounded-md bg-panel-2" aria-hidden />}
        <span className="truncate text-sm">{name}</span>
      </span>
    );
  };
  const tab = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-accent font-semibold text-bg" : "bg-panel-2 text-muted hover:text-text"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon src={img.champion(version, champ.image.full)} alt={champ.name} size={64} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            {champ.name} {ko ? (mode === "mayhem" ? "증바람 템트리" : "칼바람 템트리") : `${modeName(mode, false)} build`}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {enough
              ? ko
                ? `실제 ${a.games.toLocaleString()}게임 · 승률 ${base.toFixed(1)}% · 패치 ${data.patch}`
                : `${a.games.toLocaleString()} real games · ${base.toFixed(1)}% win rate · patch ${data.patch}`
              : ko
                ? mode === "mayhem" ? "지금은 증바람이 열려 있지 않아서 게임이 없어요. 칼바람 탭을 봐 주세요." : "아직 게임이 충분히 모이지 않았어요."
                : mode === "mayhem" ? "ARAM: Mayhem isn't live right now. Try the ARAM tab." : "Not enough games collected yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ARAM_MODES.map((m) => (
            <Link key={m} href={`/aram/${champ.id}?mode=${m}`} className={tab(mode === m)}>{modeName(m, ko)}</Link>
          ))}
        </div>
      </div>

      {enough && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={ko ? "승률 높은 템트리 (코어 3개)" : "Best core builds (3 items)"}>
            {builds.length === 0 ? (
              <p className="text-sm text-muted">{ko ? "같은 조합이 아직 충분히 모이지 않았어요." : "No combination has enough games yet."}</p>
            ) : (
              <ul className="space-y-2">
                {builds.map((b) => (
                  <li key={b.key} className="flex items-center gap-1.5">
                    {b.key.split(",").map((iid) => <ItemIcon key={iid} id={iid} />)}
                    <Stat row={b} ko={ko} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={ko ? "많이 가는 아이템" : "Most built items"}>
            <ul className="space-y-1.5">
              {topItems.map((r) => (
                <li key={r.key} className="flex items-center gap-2">
                  <ItemIcon id={r.key} size={30} />
                  <span className="min-w-0 truncate text-sm">{itemById.get(r.key)?.name ?? r.key}</span>
                  <Stat row={r} ko={ko} />
                </li>
              ))}
            </ul>
            {boots.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1.5 text-xs font-semibold text-muted">{ko ? "신발" : "Boots"}</p>
                <ul className="space-y-1.5">
                  {boots.map((r) => (
                    <li key={r.key} className="flex items-center gap-2">
                      <ItemIcon id={r.key} size={30} />
                      <span className="min-w-0 truncate text-sm">{itemById.get(r.key)?.name ?? r.key}</span>
                      <Stat row={r} ko={ko} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {mode === "mayhem" && augPick.length > 0 && (
            <>
              <Panel title={ko ? "승률 높은 증강" : "Best augments"}>
                <ul className="space-y-1.5">
                  {augBest.map((r) => (
                    <li key={r.key} className="flex items-center gap-2"><Aug aid={r.key} /><Stat row={r} ko={ko} /></li>
                  ))}
                </ul>
              </Panel>
              <Panel title={ko ? "많이 고르는 증강" : "Most picked augments"}>
                <ul className="space-y-1.5">
                  {augPick.map((r) => (
                    <li key={r.key} className="flex items-center gap-2"><Aug aid={r.key} /><Stat row={r} ko={ko} /></li>
                  ))}
                </ul>
                {augSets.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted">{ko ? "같이 고르면 좋은 증강 2개" : "Best augment pairs"}</p>
                    <ul className="space-y-2">
                      {augSets.map((r) => (
                        <li key={r.key} className="flex items-center gap-3">
                          <span className="flex min-w-0 flex-col gap-1">{r.key.split(",").map((x) => <Aug key={x} aid={x} />)}</span>
                          <Stat row={r} ko={ko} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </>
          )}

          {(allies.length > 0 || hard.length > 0) && (
            <Panel title={ko ? "같이 하면 잘 이기는 팀원 · 만나면 힘든 상대" : "Best teammates and toughest enemies"}>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { rows: allies, label: ko ? "같이 하면 잘 이겨요" : "Wins more with" },
                  { rows: hard, label: ko ? "만나면 자주 져요" : "Loses more against" },
                ].map(({ rows, label }) => (
                  <div key={label}>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{label}</p>
                    <ul className="space-y-1.5">
                      {rows.map((r) => {
                        const c = champByKey.get(r.key);
                        if (!c) return null;
                        return (
                          <li key={r.key}>
                            <Link href={`/aram/${c.id}?mode=${mode}`} className="flex items-center gap-2 hover:text-accent">
                              <Icon src={img.champion(version, c.image.full)} alt={c.name} size={28} className="rounded-md" />
                              <span className="min-w-0 truncate text-sm">{c.name}</span>
                              <Stat row={r} ko={ko} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title={ko ? "룬 · 스펠" : "Runes and spells"}>
            <ul className="space-y-2">
              {runeRows.map((r) => {
                const [pri, keys, sec] = r.key.split("|");
                const ks = runeById.get(Number(keys.split(",")[0]));
                const st = runeById.get(Number(sec));
                return (
                  <li key={r.key} className="flex items-center gap-2">
                    {ks && <Icon src={img.rune(ks.icon)} alt={ks.name} size={32} />}
                    {st && <Icon src={img.rune(st.icon)} alt={st.name} size={22} className="opacity-80" />}
                    <span className="min-w-0 truncate text-sm">{ks?.name ?? pri}{st ? ` + ${st.name}` : ""}</span>
                    <Stat row={r} ko={ko} />
                  </li>
                );
              })}
              {spellRows.map((r) => (
                <li key={r.key} className="flex items-center gap-2">
                  {r.key.split(",").map((k) => {
                    const s = spellByKey.get(k);
                    return s ? <Icon key={k} src={img.spell(version, s.image.full)} alt={s.name} size={28} /> : null;
                  })}
                  <span className="min-w-0 truncate text-sm">{r.key.split(",").map((k) => spellByKey.get(k)?.name ?? k).join(" + ")}</span>
                  <Stat row={r} ko={ko} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <p className="text-sm">
        <Link href={`/aram?mode=${mode}`} className="text-accent hover:underline">
          {ko ? `← ${modeName(mode, true)} 전체 챔피언 순위` : `← All ${modeName(mode, false)} champions`}
        </Link>
        <span className="mx-2 text-muted">·</span>
        <Link href={`/champions/${champ.id}`} className="text-accent hover:underline">
          {ko ? `${champ.name} 솔로랭크 빌드` : `${champ.name} ranked build`}
        </Link>
      </p>
    </div>
  );
}
