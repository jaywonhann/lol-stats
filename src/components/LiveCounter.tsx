"use client";

import { useEffect, useState } from "react";
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
export default function LiveCounter({ server }: { server: Server }) {
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
    return <p className="mt-3 text-sm text-muted">실시간 인원은 아직 준비 중이에요.</p>;
  if (!points.length) return <p className="mt-3 text-sm text-muted">지금 게임 중인 인원을 확인하는 중…</p>;

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
        <span className="text-4xl font-bold tabular-nums">{now.toLocaleString("ko-KR")}</span>
        <span className="text-lg font-semibold text-muted">명</span>
        {diff !== null && diff !== 0 && (
          <span className="text-sm font-semibold tabular-nums">
            {diff > 0 ? "▲" : "▼"}
            {Math.abs(diff).toLocaleString("ko-KR")}
          </span>
        )}
      </p>
      <p className="text-sm text-muted">
        지금 게임 중인 마스터 이상 랭커 (추정, 전체 {last.total.toLocaleString("ko-KR")}명 중)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" preserveAspectRatio="none" role="img" aria-label="실시간 인원 추이">
        <path d={line} fill="none" stroke="var(--chart-up)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.at} cx={x(i)} cy={y(p.estimate)} r={i === points.length - 1 ? 3 : 0} fill="var(--chart-up)">
            <title>{`${new Date(p.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 약 ${p.estimate}명`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted">
        2분마다 갱신 · 이 페이지를 열어 둔 동안의 흐름 · 마스터+ 랭커 {SAMPLE_TEXT}
      </p>
    </div>
  );
}

const SAMPLE_TEXT = "20명씩 표본 조사";
