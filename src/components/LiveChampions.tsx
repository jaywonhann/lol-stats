import { img, type Champion } from "@/lib/ddragon";
import { dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";
import { liveChampions, liveHistory } from "@/lib/live-history";
import LiveChampionsList from "./LiveChampionsList";

// 지금 게임 중인 인원이 각각 어떤 챔피언을 하고 있는지 (진행 중 랭크 게임 표본의 비율로 나눔)
export default async function LiveChampions({
  server,
  lang,
  champions,
  version,
}: {
  server: Server;
  lang: Lang;
  champions: Champion[];
  version: string;
}) {
  const t = dict(lang);
  const [data, history] = await Promise.all([liveChampions(server), liveHistory(server)]);
  const recent = history.slice(-3);
  const initial = recent.length
    ? Math.round(recent.reduce((s, p) => s + p.estimate, 0) / recent.length)
    : 0;
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const rows = data.top.flatMap((r) => {
    const c = byKey.get(r.key);
    return c ? [{ key: r.key, id: c.id, name: c.name, icon: img.champion(version, c.image.full), n: r.n }] : [];
  });

  return (
    <section>
      <div className="mb-1">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="live-dot h-2 w-2 rounded-full bg-red-500" aria-hidden />
          {t.liveChampsTitle}
        </h2>
        {rows.length > 0 && (
          <p className="mt-0.5 text-xs text-muted">
            {t.liveChampsNote(data.games, data.hours)}
            {data.updatedAt && ` · ${timeAgo(data.updatedAt, lang, { minutes: true })}`}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl border border-line bg-panel p-4 text-sm text-muted">{t.liveChampsEmpty}</p>
      ) : (
        <LiveChampionsList
          rows={rows}
          initial={initial}
          nl={numLocale(lang)}
          labels={{
            total: t.liveChampsTotal,
            players: t.liveChampsPlayers,
            more: t.liveChampsMore,
            less: t.liveChampsLess,
            sum: t.liveChampsSum,
            waiting: t.liveChecking,
          }}
        />
      )}
    </section>
  );
}
