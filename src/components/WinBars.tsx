// 승률 막대 (가운데 50% 선 기준). 표본 3판 미만은 흐리게. 서버·클라이언트 둘 다에서 써요.
export type WinBar = { label: string; n: number; rate: number | null };

export default function WinBars({ rows, gamesN, few }: { rows: WinBar[]; gamesN: (n: number) => string; few: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const usable = r.n >= 3 && r.rate !== null;
        const color = !usable ? "var(--color-muted)" : r.rate! >= 55 ? "var(--chart-up)" : r.rate! < 45 ? "var(--chart-down)" : "var(--color-accent)";
        return (
          <li key={r.label} className={usable ? "" : "opacity-60"}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums">
                {r.rate !== null && <b style={{ color }}>{r.rate.toFixed(0)}%</b>}
                <span className="ml-2 text-xs text-muted">{usable ? gamesN(r.n) : `${few} · ${gamesN(r.n)}`}</span>
              </span>
            </div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-panel-2" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.rate ?? 0)}%`, background: color }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
