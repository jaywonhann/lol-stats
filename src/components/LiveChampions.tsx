import Link from "next/link";
import { Icon } from "./ui";
import { img, type Champion } from "@/lib/ddragon";
import { dict, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";
import { liveChampions } from "@/lib/live-history";

// 지금 진행 중인 랭크 게임에서 가장 많이 나온 챔피언 (표본 게임 기준)
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
  const data = await liveChampions(server);
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const rows = data.top
    .map((r) => ({ ...r, champ: byKey.get(r.key) }))
    .filter((r): r is typeof r & { champ: Champion } => !!r.champ)
    .slice(0, 10);
  const max = rows[0]?.n ?? 1;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="live-dot h-2 w-2 rounded-full bg-red-500" aria-hidden />
            {t.liveChampsTitle}
          </h2>
          {rows.length > 0 && (
            <p className="mt-0.5 text-xs text-muted">{t.liveChampsNote(data.games, data.hours)}</p>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">{t.liveChampsEmpty}</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map((r, i) => (
            <li key={r.key}>
              <Link
                href={`/champions/${r.champ.id}`}
                className="lift flex items-center gap-3 rounded-xl border border-line bg-panel p-3"
              >
                <span className="w-4 text-center text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                <Icon src={img.champion(version, r.champ.image.full)} alt={r.champ.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.champ.name}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded bg-panel-2">
                    <span
                      className="block h-full rounded bg-accent"
                      style={{ width: `${(r.n / max) * 100}%` }}
                    />
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted">{t.liveChampsGames(r.n)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
