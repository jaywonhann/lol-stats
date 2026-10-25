"use client";

import { useState } from "react";

type Point = { label: string; value: number; note?: string };

// 패치별 추이 꺾은선 그래프. 마우스를 올리면 해당 패치 값이 보입니다.
export default function TrendChart({
  title,
  points,
  suffix = "",
  decimals = 2,
  invert = false,
  baseline,
}: {
  title: string;
  points: Point[];
  suffix?: string;
  decimals?: number;
  invert?: boolean; // 순위처럼 값이 작을수록 좋은 경우 위아래 반전
  baseline?: number; // 기준선 (예: 승률 50%)
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 180, L = 44, R = 16, T = 16, B = 28;
  const values = points.map((p) => p.value);
  let min = Math.min(...values, baseline ?? Infinity);
  let max = Math.max(...values, baseline ?? -Infinity);
  const pad = (max - min) * 0.15 || 1;
  min -= pad;
  max += pad;
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => {
    const t = (v - min) / (max - min);
    return T + (invert ? t : 1 - t) * (H - T - B);
  };
  const fmt = (v: number) => `${v.toFixed(decimals)}${suffix}`;
  const rawTicks = [min + pad, (min + max) / 2, max - pad];
  // 순위 그래프는 정수 눈금만, 겹치는 눈금은 하나로
  const ticks = [...new Set(rawTicks.map((t) => (invert ? Math.round(t) : Number(t.toFixed(1)))))];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join("");
  const active = hover ?? points.length - 1;
  const ap = points[active];

  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>{title}</span>
        <span>
          <span className="text-text">{ap.label}</span> · <span className="font-semibold text-text">{fmt(ap.value)}</span>
          {ap.note && <span className="ml-1">{ap.note}</span>}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`${title}: ${points.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const step = points.length > 1 ? (W - L - R) / (points.length - 1) : 1;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round((px - L) / step))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={L - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-xs">
              {t.toFixed(invert ? 0 : 1)}
            </text>
          </g>
        ))}
        {baseline !== undefined && (
          <line x1={L} x2={W - R} y1={y(baseline)} y2={y(baseline)} stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth={1} />
        )}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" className={`text-xs ${i === active ? "fill-text" : "fill-muted"}`}>
            {p.label}
          </text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-muted)" strokeWidth={1} />}
        <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={x(i)}
            cy={y(p.value)}
            r={i === active ? 5 : 3}
            fill="var(--chart-line)"
            stroke="var(--color-panel)"
            strokeWidth={2}
          />
        ))}
      </svg>
    </figure>
  );
}
