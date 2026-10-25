import { dict, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import { serverLabel, type Server } from "@/lib/lanes";
import { loadActivity } from "@/lib/real";
import LiveCounter from "./LiveCounter";
import { liveHistory } from "@/lib/live-history";

// 한국 시간(KST, UTC+9) 기준 시(0~23)
const kstHour = (iso: string) => (new Date(iso).getUTCHours() + 9) % 24;

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wider text-white">
      <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden />
      LIVE
    </span>
  );
}

// 서버별 최근 24시간 랭크 게임 수와 시간대별 막대
export default async function LivePanel({
  server,
  lang,
  hero = false,
}: {
  server: Server;
  lang: Lang;
  hero?: boolean;
}) {
  const t = dict(lang);
  const name = serverLabel(server, lang);
  const a = loadActivity(server);
  const history = hero ? await liveHistory(server) : [];
  const max = Math.max(1, ...(a?.hours.map((h) => h.games) ?? []));
  return (
    <section
      className={
        hero
          ? "relative grid gap-6 overflow-hidden rounded-xl border border-line bg-panel p-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-red-500/70 before:to-transparent md:grid-cols-[1.3fr_1fr] md:p-6"
          : "rounded-lg border border-line bg-panel p-4 lg:w-[380px]"
      }
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <LiveBadge />
            {hero && (
              <span className="text-sm font-semibold">{t.liveHeroTitle}</span>
            )}
          </span>
          <span className="text-xs text-muted">
            {t.liveSubtitle(
              name,
              a
                ? t.updated(timeAgo(a.updatedAt, lang, { minutes: true }))
                : null,
            )}
          </span>
        </div>
        <LiveCounter server={server} lang={lang} big={hero} history={history} />
      </div>
      <div className={hero ? "md:border-l md:border-line md:pl-6" : ""}>
        {a ? (
          <>
            <p
              className={`text-2xl font-bold tabular-nums ${hero ? "border-t border-line pt-3 md:mt-1 md:border-0 md:pt-0 md:text-4xl" : "mt-4 border-t border-line pt-3"}`}
            >
              {a.total.toLocaleString(numLocale(lang))}
              <span className="ml-1 text-base font-semibold text-muted">
                {t.gamesUnit}
              </span>
            </p>
            <p className="text-sm text-muted">{t.last24h(name)}</p>
            <div
              className="mt-3 flex h-12 items-end gap-[2px]"
              role="img"
              aria-label={t.gamesByHour}
            >
              {a.hours.map((h) => (
                <span
                  key={h.at}
                  title={t.hourTitle(kstHour(h.at), h.games)}
                  className="flex-1 rounded-t-[2px] hover:opacity-70"
                  style={{
                    height: `${Math.max(4, (h.games / max) * 100)}%`,
                    background: h.games
                      ? "var(--chart-line)"
                      : "var(--chart-grid)",
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{t.hourLabel(kstHour(a.hours[0].at))}</span>
              <span>{t.gamesByHourKst}</span>
              <span>{t.hourLabel(kstHour(a.hours[23].at))}</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">{t.activityCollecting}</p>
        )}
      </div>
    </section>
  );
}
