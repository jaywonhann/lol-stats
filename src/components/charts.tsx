// 서버에서 그리는 작은 차트들 (스파크라인, 상승/하락 막대)

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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <path d={pts.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join("")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />
    </svg>
  );
}

type Bar = { label: string; value: number; detail: string };

// 0을 기준으로 오른쪽(파랑)=상승, 왼쪽(빨강)=하락. 값 라벨에 ▲▼ 기호를 같이 붙여 색만으로 구분하지 않습니다.
export function DivergingBars({ bars, title }: { bars: Bar[]; title: string }) {
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
              {up ? "▲" : "▼"}
              {Math.abs(b.value).toFixed(1)}
            </span>
          );
          return (
            <div key={b.label} role="listitem" title={`${b.label}: ${b.detail}`} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-0 rounded hover:bg-panel-2 sm:grid-cols-[7rem_1fr_1fr]">
              <span className="truncate pr-3 text-right text-sm">{b.label}</span>
              <div className="flex h-6 items-center justify-end gap-2 border-r border-muted pr-px">
                {!up && (
                  <>
                    {label}
                    <span className="h-3.5 rounded-l-[4px]" style={{ width: pctW, background: "var(--chart-down)" }} />
                  </>
                )}
              </div>
              <div className="flex h-6 items-center gap-2 pl-px">
                {up && (
                  <>
                    <span className="h-3.5 rounded-r-[4px]" style={{ width: pctW, background: "var(--chart-up)" }} />
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
export function WinRateBars({ rows, title }: { rows: WinRateBar[]; title: string }) {
  const maxAbs = Math.max(5, ...rows.map((r) => Math.abs(r.winRate - 50)));
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-muted">{title}</figcaption>
      <div className={`mb-1 grid grid-cols-[minmax(0,7rem)_1fr_4.5rem] ${rows.length ? "" : "hidden"} text-[10px] text-muted sm:grid-cols-[minmax(0,9rem)_1fr_5rem]`}>
        <span />
        <span className="relative flex justify-between">
          <span>{(50 - maxAbs).toFixed(0)}%</span>
          <span className="absolute left-1/2 -translate-x-1/2">50%</span>
          <span>{(50 + maxAbs).toFixed(0)}%</span>
        </span>
        <span />
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">아직 표본이 부족해요.</p>}
      <div className="space-y-1" role="list">
        {rows.map((r) => {
          const d = r.winRate - 50;
          const up = d >= 0;
          const w = `${Math.max(1, (Math.abs(d) / maxAbs) * 100)}%`;
          return (
            <div
              key={r.key}
              role="listitem"
              title={`${r.name}: 승률 ${r.winRate.toFixed(1)}% (${r.games.toLocaleString("ko-KR")}게임)`}
              className="grid grid-cols-[minmax(0,7rem)_1fr_1fr_4.5rem] items-center rounded hover:bg-panel-2 sm:grid-cols-[minmax(0,9rem)_1fr_1fr_5rem]"
            >
              <span className="flex min-w-0 items-center gap-1 pr-2">{r.label}</span>
              <div className="flex h-8 items-center justify-end border-r border-muted pr-px">
                {!up && <span className="h-3.5 rounded-l-[4px]" style={{ width: w, background: "var(--chart-down)" }} />}
              </div>
              <div className="flex h-8 items-center pl-px">
                {up && <span className="h-3.5 rounded-r-[4px]" style={{ width: w, background: "var(--chart-up)" }} />}
              </div>
              <span className="text-right text-xs leading-tight">
                <span className="text-text">{r.winRate.toFixed(1)}%</span>
                <span className="block text-[10px] text-muted">{r.games.toLocaleString("ko-KR")}게임</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
