// 서버에서 그리는 작은 차트들 (스파크라인, 상승/하락 막대)
import { dict, numLocale, type Lang } from "@/lib/i18n";

export function Sparkline({ values, width = 96, height = 28 }: { values: (number | null)[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => 3 + (i * (width - 6)) / (values.length - 1);
  const y = (v: number) => 3 + (1 - (v - min) / (max - min || 1)) * (height - 6);
  const last = pts[pts.length - 1];
  const color = "var(--color-muted)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="line-reveal shrink-0">
      <path d={pts.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join("")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />
    </svg>
  );
}

type Bar = { label: string; value: number; detail: string };

// 0을 기준으로 오른쪽(파랑)=상승, 왼쪽(빨강)=하락. 값 라벨에 ▲▼ 기호를 같이 붙여 색만으로 구분하지 않습니다.
// format을 주면 값 라벨을 바꿀 수 있습니다 (기본: ▲1.2 / ▼1.2)
export function DivergingBars({ bars, title, format, wide = false }: { bars: Bar[]; title: string; format?: (v: number) => string; wide?: boolean }) {
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 0.1);
  return (
    <figure>
      <figcaption className="mb-3 text-xs text-muted">{title}</figcaption>
      <div className="space-y-1" role="list">
        {bars.map((b) => {
          const up = b.value >= 0;
          const pctW = `${Math.max(1, (Math.abs(b.value) / maxAbs) * 100)}%`;
          const label = (
            <span className="text-xs text-text">
              {format ? format(b.value) : `${up ? "▲" : "▼"}${Math.abs(b.value).toFixed(1)}`}
            </span>
          );
          return (
            <div key={b.label} role="listitem" title={`${b.label}: ${b.detail}`} className={`grid items-center gap-0 rounded hover:bg-panel-2 ${wide ? "grid-cols-[7rem_1fr_1fr]" : "grid-cols-[5.5rem_1fr_1fr] sm:grid-cols-[7rem_1fr_1fr]"}`}>
              <span className="truncate pr-3 text-right text-sm">{b.label}</span>
              <div className="flex h-6 items-center justify-end gap-2 border-r border-muted pr-px">
                {!up && (
                  <>
                    {label}
                    <span className="bar-grow bar-grow-l h-3.5 rounded-l-[4px]" style={{ width: pctW, background: "var(--chart-down)" }} />
                  </>
                )}
              </div>
              <div className="flex h-6 items-center gap-2 pl-px">
                {up && (
                  <>
                    <span className="bar-grow h-3.5 rounded-r-[4px]" style={{ width: pctW, background: "var(--chart-up)" }} />
                    {label}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

type WinRateBar = { key: string; label: React.ReactNode; name: string; winRate: number; games: number };

// 승률을 50% 기준선에서 갈라 그립니다: 오른쪽(파랑)=50% 이상, 왼쪽(빨강)=50% 미만.
// 숫자 라벨을 항상 같이 보여줘 색만으로 구분하지 않습니다.
export function WinRateBars({ rows, title, lang }: { rows: WinRateBar[]; title: string; lang: Lang }) {
  const t = dict(lang);
  const nl = numLocale(lang);
  const maxAbs = Math.max(5, ...rows.map((r) => Math.abs(r.winRate - 50)));
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-muted">{title}</figcaption>
      <div className={`mb-1 grid grid-cols-[minmax(0,7rem)_1fr_4.5rem] ${rows.length ? "" : "hidden"} text-xs text-muted sm:grid-cols-[minmax(0,9rem)_1fr_5rem]`}>
        <span />
        <span className="relative flex justify-between">
          <span>{(50 - maxAbs).toFixed(0)}%</span>
          <span className="absolute left-1/2 -translate-x-1/2">50%</span>
          <span>{(50 + maxAbs).toFixed(0)}%</span>
        </span>
        <span />
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">{t.notEnoughSample}</p>}
      <div className="space-y-1" role="list">
        {rows.map((r) => {
          const d = r.winRate - 50;
          const up = d >= 0;
          const w = `${Math.max(1, (Math.abs(d) / maxAbs) * 100)}%`;
          return (
            <div
              key={r.key}
              role="listitem"
              title={`${r.name}: ${t.winRate} ${r.winRate.toFixed(1)}% (${t.games(r.games.toLocaleString(nl))})`}
              className="grid grid-cols-[minmax(0,7rem)_1fr_1fr_4.5rem] items-center rounded hover:bg-panel-2 sm:grid-cols-[minmax(0,9rem)_1fr_1fr_5rem]"
            >
              <span className="flex min-w-0 items-center gap-1 pr-2">{r.label}</span>
              <div className="flex h-8 items-center justify-end border-r border-muted pr-px">
                {!up && <span className="bar-grow bar-grow-l h-3.5 rounded-l-[4px]" style={{ width: w, background: "var(--chart-down)" }} />}
              </div>
              <div className="flex h-8 items-center pl-px">
                {up && <span className="bar-grow h-3.5 rounded-r-[4px]" style={{ width: w, background: "var(--chart-up)" }} />}
              </div>
              <span className="text-right text-xs leading-tight">
                <span className="text-text">{r.winRate.toFixed(1)}%</span>
                <span className="block text-xs text-muted">{t.games(r.games.toLocaleString(nl))}</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// 주식 시세처럼 보이는 작은 꺾은선 (마지막 값에 점, 아래쪽은 옅게 채움)
export function StockLine({ values, up, width = 240, height = 56 }: { values: number[]; up: boolean; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 2 + (i * (width - 8)) / (values.length - 1);
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (height - 8);
  const color = up ? "var(--chart-up)" : "var(--chart-down)";
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const area = `${line}L${x(values.length - 1)},${height}L${x(0)},${height}Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-reveal h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
