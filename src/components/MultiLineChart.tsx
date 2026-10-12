"use client";

import { useEffect, useRef, useState } from "react";

type Series = { name: string; color: string; values: (number | null)[] };

// 여러 선을 같은 축에 그리는 꺾은선 그래프. 마우스를 올리면 그날 값이 모두 보입니다.
export default function MultiLineChart({
  labels,
  series,
  suffix = "%",
  baseline,
  height = 200,
}: {
  labels: string[];
  series: Series[];
  suffix?: string;
  baseline?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // 실제 너비에 맞춰 그려서 글자 크기가 화면 크기와 상관없이 일정하게
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height, L = 40, R = 16, T = 12, B = 26;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!all.length) return <figure ref={ref} />;
  let min = Math.min(...all, baseline ?? Infinity);
  let max = Math.max(...all, baseline ?? -Infinity);
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;
  const n = labels.length;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [...new Set([min + pad, (min + max) / 2, max - pad].map((t) => Number(t.toFixed(1))))];
  const pathOf = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)}`;
      pen = true;
    });
    return d;
  };
  const every = Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 56))); // x축 라벨이 겹치지 않게
  const active = hover ?? n - 1;

  return (
    <figure ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={series.map((s) => `${s.name}: ${s.values.map((v, i) => `${labels[i]} ${v === null ? "-" : v.toFixed(1) + suffix}`).join(", ")}`).join(" / ")}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const step = n > 1 ? (W - L - R) / (n - 1) : 1;
          setHover(Math.max(0, Math.min(n - 1, Math.round((px - L) / step))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={L - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {baseline !== undefined && (
          <line x1={L} x2={W - R} y1={y(baseline)} y2={y(baseline)} stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth={1} />
        )}
        {labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[11px] ${i === active ? "fill-text" : "fill-muted"}`}>
              {l}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-muted)" strokeWidth={1} />}
        {series.map((s) => (
          <path key={s.name} d={pathOf(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) =>
          s.values[active] !== null ? (
            <circle key={s.name} cx={x(active)} cy={y(s.values[active]!)} r={4} fill={s.color} stroke="var(--color-panel)" strokeWidth={2} />
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="text-text">{labels[active]}</span>
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
            {s.name}
            <span className="text-text">{s.values[active] === null ? "–" : `${s.values[active]!.toFixed(1)}${suffix}`}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
