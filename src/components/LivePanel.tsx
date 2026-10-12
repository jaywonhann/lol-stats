import { serverLabel, type Server } from "@/lib/lanes";
import { loadActivity } from "@/lib/real";

const kstHour = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false });

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wider text-white">
      <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden />
      LIVE
    </span>
  );
}

// 서버별 최근 24시간 랭크 게임 수와 시간대별 막대
export default function LivePanel({ server }: { server: Server }) {
  const a = loadActivity(server);
  const max = Math.max(1, ...(a?.hours.map((h) => h.games) ?? []));
  return (
    <section className="rounded-lg border border-line bg-panel p-4 lg:w-[380px]">
      <div className="flex items-center justify-between gap-2">
        <LiveBadge />
        <span className="text-xs text-muted">
          {serverLabel(server)} 서버{a && ` · ${ago(a.updatedAt)} 업데이트`}
        </span>
      </div>
      {a ? (
        <>
          <p className="mt-3 text-4xl font-bold tabular-nums">
            {a.total.toLocaleString("ko-KR")}
            <span className="ml-1 text-lg font-semibold text-muted">판</span>
          </p>
          <p className="text-sm text-muted">
            최근 24시간 동안 분석한 {serverLabel(server)} 서버 랭크 게임
          </p>
          <div className="mt-3 flex h-12 items-end gap-[2px]" role="img" aria-label="시간대별 게임 수">
            {a.hours.map((h) => (
              <span
                key={h.at}
                title={`${kstHour(h.at)}시: ${h.games}판`}
                className="flex-1 rounded-t-[2px] hover:opacity-70"
                style={{ height: `${Math.max(4, (h.games / max) * 100)}%`, background: h.games ? "var(--chart-line)" : "var(--chart-grid)" }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{kstHour(a.hours[0].at)}시</span>
            <span>시간대별 게임 수 (한국 시간)</span>
            <span>{kstHour(a.hours[23].at)}시</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          이 서버의 게임을 모으는 중이에요. 수집이 끝나면 최근 24시간 게임 수가 표시돼요.
        </p>
      )}
    </section>
  );
}
