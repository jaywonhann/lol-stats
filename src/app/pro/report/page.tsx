import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Panel } from "@/components/ui";
import WinBars from "@/components/WinBars";
import ProHours from "@/components/ProHours";
import { deepReport, type DeepReport } from "@/lib/deep";
import { getChampions, getVersion, img, type Champion } from "@/lib/ddragon";
import { ddLocale, dict, type Lang } from "@/lib/i18n";
import { parseServer, serverLabel } from "@/lib/lanes";
import { isPro, PRO_PRICE } from "@/lib/pro";
import { proText, type ProText } from "@/lib/pro-text";
import { lookupSummoner, parseRiotId, RiotError, type LookupError } from "@/lib/riot";
import { getLang, getServer } from "@/lib/server";
import { champSummaries, siteAverages, toGames } from "@/lib/summoner";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string | string[]; s?: string }> };

const rawId = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").slice(0, 60);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, lang] = await Promise.all([searchParams, getLang()]);
  const p = proText(lang);
  const id = rawId(sp.id).trim();
  // 사람마다 다른 페이지라 검색엔진에는 올리지 않아요
  return { title: id ? p.reportTitle(id) : p.title, robots: { index: false } };
}

type Rule = { text: string; tone: "up" | "down" | null };

const fix = (n: number) => n.toFixed(0);

function rules(r: DeepReport, p: ProText): Rule[] {
  const out: Rule[] = [];
  if (r.stopAfter === 1) out.push({ text: p.rule.stop1(fix(r.byStreak[1].rate!), r.byStreak[1].n), tone: "down" });
  else if (r.stopAfter === 2) out.push({ text: p.rule.stop2(fix(r.byStreak[2].rate!), r.byStreak[2].n), tone: "down" });
  else if (r.byStreak[1].n >= 3) out.push({ text: p.rule.noStop, tone: "up" });
  if (r.maxGames) out.push({ text: p.rule.max(r.maxGames, fix(r.byPos[r.maxGames].rate!)), tone: "down" });
  else if (r.byPos[2].n >= 3) out.push({ text: p.rule.noMax, tone: "up" });
  const name = (c: (typeof r.keep)[number]) => c.champion?.name ?? c.championName;
  if (r.keep[0]) out.push({ text: p.rule.keep(name(r.keep[0]), fix(r.keep[0].winRate), r.keep[0].games), tone: "up" });
  if (r.style === "early") out.push({ text: p.rule.early(fix(r.byLength[0].rate!)), tone: null });
  if (r.style === "late") out.push({ text: p.rule.late(fix(r.byLength[2].rate!)), tone: null });
  if (r.drop[0]) out.push({ text: p.rule.drop(name(r.drop[0]), fix(r.drop[0].winRate), r.drop[0].games), tone: "down" });
  return out;
}

const toneColor = (t: Rule["tone"]) => (t === "up" ? "var(--chart-up)" : t === "down" ? "var(--chart-down)" : "var(--color-accent)");

function RuleList({ list }: { list: Rule[] }) {
  return (
    <ol className="space-y-3">
      {list.map((r, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black text-bg" style={{ background: toneColor(r.tone) }}>
            {i + 1}
          </span>
          <p className="pt-0.5 font-medium leading-snug">{r.text}</p>
        </li>
      ))}
    </ol>
  );
}

export default async function ProReportPage({ searchParams }: Props) {
  const [sp, lang, cookieServer, pro] = await Promise.all([searchParams, getLang(), getServer(), isPro()]);
  const p = proText(lang);
  const t = dict(lang).summoner;
  const server = sp.s ? parseServer(sp.s) : cookieServer;
  const raw = rawId(sp.id);
  const parsed = raw ? parseRiotId(raw, server) : null;
  const proHref = `/pro?id=${encodeURIComponent(raw)}&s=${server}`;
  if (!parsed)
    return (
      <Panel>
        <Link href="/pro" className="text-sm font-semibold text-accent hover:underline">
          {p.openLabel} →
        </Link>
      </Panel>
    );

  const riotId = `${parsed.gameName}#${parsed.tagLine}`;
  const summonerHref = `/summoner?id=${encodeURIComponent(riotId)}&s=${server}`;
  let error: LookupError | null = null;
  // 잠긴 화면은 소환사 페이지와 같은 20판(이미 캐시됨)만 읽어 Riot 호출을 아껴요
  const result = await lookupSummoner(server, parsed.gameName, parsed.tagLine, pro ? 60 : 20).catch((e) => {
    error = e instanceof RiotError ? e.kind : "error";
    return null;
  });
  const head = (
    <section className="space-y-2">
      <Link href={summonerHref} className="text-sm text-muted hover:text-text">
        {p.back}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-accent px-2 py-0.5 text-xs font-black text-bg">{p.badge}</span>
        <h1 className="text-2xl font-black">{p.reportTitle(result ? `${result.account.gameName}#${result.account.tagLine}` : riotId)}</h1>
      </div>
    </section>
  );
  if (!result) {
    const e = error as LookupError | null;
    const message =
      e === "not-found" ? t.notFound(riotId, serverLabel(server, lang)) : e === "rate-limited" ? t.rateLimited : e === "unavailable" ? t.unavailable : t.error;
    return (
      <div className="space-y-6">
        {head}
        <Panel>
          <p role="alert" className="text-sm">
            {message}
          </p>
        </Panel>
      </div>
    );
  }

  const [version, champions] = await Promise.all([
    getVersion().catch(() => null),
    getChampions(ddLocale(lang))
      .then((r) => r.champions)
      .catch(() => [] as Champion[]),
  ]);
  const games = toGames(result.matches, result.account.puuid);
  const report = deepReport(games, champSummaries(games, champions, siteAverages(server)));
  const list = rules(report, p);

  if (!pro) return <Locked head={head} first={list[0]} lang={lang} proHref={proHref} />;

  const champRow = (c: (typeof report.keep)[number]) => (
    <li key={c.championId} className="flex items-center gap-3">
      {c.champion && version && <Icon src={img.champion(version, c.champion.image.full)} alt={c.champion.name} size={36} />}
      <span className="font-medium">{c.champion?.name ?? c.championName}</span>
      <span className="ml-auto text-sm tabular-nums">
        <b>{fix(c.winRate)}%</b> <span className="text-xs text-muted">{p.gamesN(c.games)}</span>
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      {head}
      <p className="text-sm text-muted">{p.based(report.games, report.sessions)}</p>
      <Panel title={p.rulesTitle}>{list.length ? <RuleList list={list} /> : <p className="text-sm text-muted">{p.previewNone}</p>}</Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={p.streakTitle}>
          <WinBars rows={report.byStreak.map((b, i) => ({ label: p.streakLabels[i], ...b }))} gamesN={p.gamesN} few={p.few} />
        </Panel>
        <Panel title={p.posTitle}>
          <WinBars rows={report.byPos.map((b, i) => ({ label: p.posLabels[i], ...b }))} gamesN={p.gamesN} few={p.few} />
        </Panel>
        <Panel title={p.hourTitle}>
          <ProHours hours={report.hours} lang={lang} />
        </Panel>
        <Panel title={p.lengthTitle}>
          <WinBars rows={report.byLength.map((b, i) => ({ label: p.lengthLabels[i], ...b }))} gamesN={p.gamesN} few={p.few} />
        </Panel>
        <Panel title={p.champsTitle}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--chart-up)" }}>
            {p.keepTitle}
          </h3>
          {report.keep.length ? <ul className="space-y-2">{report.keep.map(champRow)}</ul> : <p className="text-sm text-muted">{p.noneKeep}</p>}
          <h3 className="mb-2 mt-4 text-sm font-semibold" style={{ color: "var(--chart-down)" }}>
            {p.dropTitle}
          </h3>
          {report.drop.length ? <ul className="space-y-2">{report.drop.map(champRow)}</ul> : <p className="text-sm text-muted">{p.noneDrop}</p>}
        </Panel>
        {report.momentum !== null && (
          <Panel title={p.momentumTitle}>
            <p className="text-sm leading-relaxed">{p.momentum(report.momentum, fix(report.recent.rate!), fix(report.before.rate!))}</p>
          </Panel>
        )}
      </div>
      <p className="text-xs text-muted">{p.note}</p>
    </div>
  );
}

// 결제 전: 1번 규칙만 보여주고 나머지는 잠가요. 잠긴 부분은 실제 값이 아닌 고정된 장식이라 HTML에도 내 기록이 안 나가요.
function Locked({ head, first, lang, proHref }: { head: React.ReactNode; first?: Rule; lang: Lang; proHref: string }) {
  const p = proText(lang);
  const fake = [62, 48, 35, 57].map((rate, i) => ({ label: p.posLabels[i], n: 9, rate }));
  return (
    <div className="space-y-4">
      {head}
      <Panel title={p.previewTitle}>{first ? <RuleList list={[first]} /> : <p className="text-sm text-muted">{p.previewNone}</p>}</Panel>
      <div className="relative overflow-hidden rounded-lg">
        <div className="pointer-events-none select-none blur-sm" aria-hidden>
          <div className="grid gap-4 md:grid-cols-2">
            {[p.streakTitle, p.posTitle, p.hourTitle, p.lengthTitle].map((title) => (
              <Panel key={title} title={title}>
                <WinBars rows={fake} gamesN={p.gamesN} few={p.few} />
              </Panel>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-bg/40 p-4">
          <div className="max-w-sm rounded-xl border border-accent/50 bg-panel p-5 text-center shadow-xl">
            <p className="text-lg font-black">🔒 {p.lockedTitle}</p>
            <p className="mt-2 text-sm text-muted">{p.lockedBody}</p>
            <Link href={proHref} className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-bold text-bg hover:opacity-90">
              {p.lockedCta(PRO_PRICE)}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
