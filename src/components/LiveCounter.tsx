"use client";

import { useEffect, useState } from "react";
import { dict, numLocale, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";

type Point = { at: string; estimate: number; total: number };
type Reply = ({ available: true } & Point) | { available: false; reason: string };

const KEEP_MS = 3 * 3_600_000; // 브라우저에 최근 3시간 기록을 남겨 두고 그래프로 보여줍니다

function load(server: Server): Point[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`live-${server}`) ?? "[]") as Point[];
    return raw.filter((p) => Date.now() - new Date(p.at).getTime() < KEEP_MS);
  } catch {
    return [];
  }
}

// 지금 게임 중인 마스터+ 랭커 수(추정)를 1분마다 받아와 늘고 주는 흐름을 그립니다
export default function LiveCounter({ server, lang }: { server: Server; lang: Lang }) {
  const t = dict(lang);
  const nl = numLocale(lang);
  const [points, setPoints] = useState<Point[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "off">("loading");

  useEffect(() => {
    setPoints(load(server));
    let stop = false;
    const tick = async () => {
      try {
        const r = (await (await fetch(`/api/live?server=${server}`)).json()) as Reply;
        if (stop) return;
        if (!r.available) {
          setState("off");
          return;
        }
        setState("ok");
        setPoints((prev) => {
          if (prev.at(-1)?.at === r.at) return prev;
          const next = [...prev, { at: r.at, estimate: r.estimate, total: r.total }].filter(
            (p) => Date.now() - new Date(p.at).getTime() < KEEP_MS,
          );
          try {
            localStorage.setItem(`live-${server}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch {
        if (!stop) setState((s) => (s === "loading" ? "off" : s));
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [server]);

  if (state === "off" && !points.length)
    return <p className="mt-3 text-sm text-muted">{t.liveUnavailable}</p>;
  if (!points.length) return <p className="mt-3 text-sm text-muted">{t.liveChecking}</p>;

  // 표본이 작아 값이 튀므로 최근 3번 평균을 큰 숫자로
  const recent = points.slice(-3);
  const now = Math.round(recent.reduce((s, p) => s + p.estimate, 0) / recent.length);
  const prevSet = points.slice(-6, -3);
  const prev = prevSet.length ? Math.round(prevSet.reduce((s, p) => s + p.estimate, 0) / prevSet.length) : null;
  const diff = prev === null ? null : now - prev;
  const last = points[points.length - 1];

  const W = 320, H = 56;
  const vals = points.map((p) => p.estimate);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i: number) => (points.length === 1 ? W / 2 : 2 + (i * (W - 6)) / (points.length - 1));
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (H - 8);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.estimate)}`).join("");

  return (
    <div className="mt-3">
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums">{now.toLocaleString(nl)}</span>
        <span className="text-lg font-semibold text-muted">{t.playersUnit}</span>
        {diff !== null && diff !== 0 && (
          <span className="text-sm font-semibold tabular-nums">
            {diff > 0 ? "▲" : "▼"}
            {Math.abs(diff).toLocaleString(nl)}
          </span>
        )}
      </p>
      <p className="text-sm text-muted">
        {t.liveCaption(last.total.toLocaleString(nl))}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" preserveAspectRatio="none" role="img" aria-label={t.liveAria}>
        <path d={line} fill="none" stroke="var(--chart-up)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.at} cx={x(i)} cy={y(p.estimate)} r={i === points.length - 1 ? 3 : 0} fill="var(--chart-up)">
            <title>{t.livePointTitle(new Date(p.at).toLocaleTimeString(nl, { hour: "2-digit", minute: "2-digit" }), p.estimate)}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted">
        {t.liveFoot}
      </p>
    </div>
  );
}
