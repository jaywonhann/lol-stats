// 최근 게임 승패 흐름: 이기면 +1, 지면 -1 누적 (오래된 → 최신). 아래 W/L 칩이 각 점과 같은 열에 맞춰집니다.
// 서버에서 그리는 SVG + HTML이라 클라이언트 자바스크립트가 필요 없습니다.
export type FormGame = { win: boolean; title: string };

export default function FormChart({
  games,
  winLabel,
  lossLabel,
  oldest,
  latest,
  aria,
}: {
  games: FormGame[];
  winLabel: string;
  lossLabel: string;
  oldest: string;
  latest: string;
  aria: string;
}) {
  const n = games.length;
  if (!n) return null;
  let run = 0;
  const values = games.map((g) => (run += g.win ? 1 : -1));
  const hi = Math.max(0, ...values) + 1;
  const lo = Math.min(0, ...values) - 1;
  // 시작점(0)은 왼쪽 끝, 각 게임은 칸의 가운데
  const xs = [0, ...values.map((_, i) => ((i + 0.5) / n) * 100)];
  const ys = [0, ...values].map((v) => ((hi - v) / (hi - lo)) * 100);
  const up = values[n - 1] >= 0;
  const color = up ? "var(--chart-up)" : "var(--chart-down)";
  const path = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join("");
  const zeroY = (hi / (hi - lo)) * 100;
  const fmt = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
  return (
    <figure role="img" aria-label={aria}>
      <div className="grid grid-cols-[2rem_1fr] gap-x-2">
        <div className="relative h-36 text-right text-[10px] text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{fmt(hi - 1)}</span>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${zeroY}%` }}>
            0
          </span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{fmt(lo + 1)}</span>
        </div>
        <div className="relative h-36">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {[hi - 1, lo + 1].map((v) => (
              <line key={v} x1={0} x2={100} y1={((hi - v) / (hi - lo)) * 100} y2={((hi - v) / (hi - lo)) * 100} stroke="var(--chart-grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={100} y1={zeroY} y2={zeroY} stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={`${path}L${xs[n]},${zeroY}L0,${zeroY}Z`} fill={color} opacity={0.12} />
            <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {games.map((g, i) => (
            <span
              key={i}
              title={g.title}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel"
              style={{
                left: `${xs[i + 1]}%`,
                top: `${ys[i + 1]}%`,
                background: g.win ? "var(--chart-up)" : "var(--chart-down)",
              }}
            />
          ))}
        </div>
        <span />
        <div>
          <ol className="mt-3 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {games.map((g, i) => (
              <li
                key={i}
                title={g.title}
                className="flex h-6 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
                style={{ background: g.win ? "var(--chart-up)" : "var(--chart-down)" }}
              >
                {g.win ? winLabel : lossLabel}
              </li>
            ))}
          </ol>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>← {oldest}</span>
            <span>{latest} →</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
