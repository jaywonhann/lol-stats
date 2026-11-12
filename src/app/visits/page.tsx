import type { Metadata } from "next";
import { Panel } from "@/components/ui";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

// 사이트 주인용 방문자 현황. visits.yml이 10분마다 visits 브랜치에 남기는 기록(visits.json)을 보여줘요.
// 검색에 안 나오게 noindex이고 메뉴·사이트맵에도 넣지 않아요.
type Day = { uv?: number; land?: number; nav?: number; ref?: Record<string, number>; top?: Record<string, number> };
type Visits = { days: Record<string, Day>; updatedAt?: string };

export const metadata: Metadata = { title: "Visitors", robots: { index: false, follow: false } };

async function load(): Promise<Visits | null> {
  try {
    const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/visits/visits.json", { cache: "no-store" });
    return res.ok ? ((await res.json()) as Visits) : null;
  } catch {
    return null;
  }
}

const REF_KO: Record<string, string> = { direct: "직접 접속", google: "구글 검색", bing: "빙 검색", naver: "네이버", threads: "Threads", instagram: "인스타그램", youtube: "유튜브", reddit: "레딧", daum: "다음", inven: "인벤", dcinside: "디시인사이드", fmkorea: "펨코", tistory: "티스토리", kakao: "카카오톡", discord: "디스코드", facebook: "페이스북", x: "X(트위터)", tiktok: "틱톡", duckduckgo: "덕덕고" };
const list = (o: Record<string, number> | undefined, n: number) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n);
const add = (into: Record<string, number>, from: Record<string, number> | undefined) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v;
};

export default async function VisitsPage() {
  const ko = (await getLang()) === "ko";
  const data = await load();
  if (!data) return <p className="text-muted">{ko ? "방문 기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요." : "Couldn't load visit records. Try again shortly."}</p>;

  // 사람 수는 실제로 스크롤·터치·클릭한 접속만 센 11월 11일부터 의미가 있어요
  const keys = Object.keys(data.days).filter((d) => d >= "2026-11-11").sort();
  const today = new Date().toISOString().slice(0, 10);
  const uv = (d: string) => data.days[d]?.uv ?? 0;
  const t = uv(today);
  const yd = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const y = uv(yd);
  const last7 = keys.slice(-7);
  const prev7 = keys.slice(-14, -7);
  const sum = (ds: string[]) => ds.reduce((s, d) => s + uv(d), 0);
  const total = sum(keys);
  const max = Math.max(1, ...keys.map(uv));
  const ref: Record<string, number> = {};
  const top: Record<string, number> = {};
  for (const d of last7) {
    add(ref, data.days[d]?.ref);
    add(top, data.days[d]?.top);
  }
  const diff = t - y;
  const updated = data.updatedAt ? new Date(data.updatedAt) : null;
  const mins = updated ? Math.max(0, Math.round((Date.now() - updated.getTime()) / 60_000)) : null;

  const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="rounded-lg bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ko ? "방문자 현황" : "Visitors"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? "실제로 화면을 스크롤·터치·클릭한 사람만 세요 (검색 로봇 제외). 날짜는 UTC 기준이라 토론토 시간 저녁 7시에 하루가 바뀌어요."
            : "Counts only people who scrolled, tapped or clicked (bots excluded). Days are UTC."}
          {mins !== null && (ko ? ` 마지막 갱신 ${mins}분 전 (10분마다 갱신).` : ` Updated ${mins} min ago (every 10 min).`)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={ko ? "오늘" : "Today"}
          value={t}
          sub={diff === 0 ? (ko ? "어제와 같음" : "same as yesterday") : ko ? `어제보다 ${diff > 0 ? "+" : ""}${diff}명` : `${diff > 0 ? "+" : ""}${diff} vs yesterday`}
        />
        <Stat label={ko ? "어제" : "Yesterday"} value={y} />
        <Stat
          label={ko ? "최근 7일" : "Last 7 days"}
          value={sum(last7)}
          sub={prev7.length ? (ko ? `그 전 7일 ${sum(prev7)}명` : `prior 7 days: ${sum(prev7)}`) : undefined}
        />
        <Stat label={ko ? "11월 11일부터 전체" : "Since Nov 11"} value={total} />
      </div>

      <Panel title={ko ? "날짜별 방문자" : "Visitors per day"}>
        <div className="space-y-1.5">
          {[...keys].reverse().map((d) => (
            <div key={d} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 tabular-nums text-muted">{d.slice(5).replace("-", "/")}</span>
              <div className="h-5 min-w-0 flex-1 rounded bg-bg">
                <div className="h-5 rounded bg-accent" style={{ width: `${(uv(d) / max) * 100}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right tabular-nums">
                {uv(d)}
                {ko ? "명" : ""} <span className="text-xs text-muted">· {ko ? `이동 ${data.days[d]?.nav ?? 0}` : `${data.days[d]?.nav ?? 0} clicks`}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={ko ? "어디서 왔나 (최근 7일, 첫 접속 횟수)" : "Where they came from (last 7 days)"}>
          {list(ref, 10).length ? (
            <ul className="space-y-1 text-sm">
              {list(ref, 10).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span>{ko ? (REF_KO[k] ?? k) : k}</span>
                  <span className="tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{ko ? "아직 없어요" : "None yet"}</p>
          )}
        </Panel>
        <Panel title={ko ? "많이 본 페이지 (최근 7일)" : "Top pages (last 7 days)"}>
          {list(top, 10).length ? (
            <ul className="space-y-1 text-sm">
              {list(top, 10).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{ko ? "아직 없어요" : "None yet"}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
