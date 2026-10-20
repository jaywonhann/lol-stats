"use client";

import { useEffect, useRef, useState } from "react";
import { dict, numLocale, type Lang } from "@/lib/i18n";
import type { Server } from "@/lib/lanes";

type Point = { at: string; estimate: number; total: number };
type Reply =
  | ({ available: true } & Point)
  | { available: false; reason: string };

const POLL_MS = 30_000; // 30초마다 확인 (서버 기록은 10분마다 새로 쌓임)
const KEEP_MS = 3 * 3_600_000; // 브라우저에 최근 3시간 기록을 남겨 두고 그래프로 보여줍니다

function load(server: Server): Point[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(`live2-${server}`) ?? "[]",
    ) as Point[];
    return raw.filter((p) => Date.now() - new Date(p.at).getTime() < KEEP_MS);
  } catch {
    return [];
  }
}

// 지금 게임 중인 전체 플레이어 수(추정)를 1분마다 받아와 늘고 주는 흐름을 그립니다
export default function LiveCounter({
  server,
  lang,
  big = false,
  history = [],
}: {
  server: Server;
  lang: Lang;
  big?: boolean;
  history?: Point[];
}) {
  const t = dict(lang);
  const nl = numLocale(lang);
  const [live, setPoints] = useState<Point[]>([]);
  // 서버에 쌓인 기록(10분 간격, 최근 24시간) + 이 페이지에서 받은 값(1분 간격)을 시간순으로 합침
  const points = [...history, ...live]
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((p, i, arr) => i === 0 || p.at !== arr[i - 1].at);
  const [state, setState] = useState<"loading" | "ok" | "off">("loading");
  const [nextAt, setNextAt] = useState(0);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    setPoints(load(server));
    let stop = false;
    const tick = async () => {
      try {
        const r = (await (
          await fetch(`/api/live?server=${server}`)
        ).json()) as Reply;
        if (stop) return;
        if (!r.available) {
          setState("off");
          return;
        }
        setState("ok");
        setPoints((prev) => {
          if (prev.at(-1)?.at === r.at) return prev;
          const next = [
            ...prev,
            { at: r.at, estimate: r.estimate, total: r.total },
          ].filter((p) => Date.now() - new Date(p.at).getTime() < KEEP_MS);
          try {
            localStorage.setItem(`live2-${server}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch {
        if (!stop) setState((s) => (s === "loading" ? "off" : s));
      }
    };
    const run = () => {
      setNextAt(Date.now() + POLL_MS);
      tick();
    };
    run();
    const id = setInterval(run, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [server]);

  // 1초마다 다음 갱신까지 남은 시간 표시
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 표본이 작아 값이 튀므로 최근 3번 평균을 큰 숫자로
  const recent = points.slice(-3);
  const now = recent.length
    ? Math.round(recent.reduce((s, p) => s + p.estimate, 0) / recent.length)
    : 0;

  // 아래 "지금 많이 하는 챔피언"이 같은 숫자로 나눌 수 있게 알려줌
  useEffect(() => {
    if (now <= 0) return;
    (window as unknown as { livelolNow?: number }).livelolNow = now;
    window.dispatchEvent(new CustomEvent("livelol:now", { detail: now }));
  }, [now]);

  // 숫자가 바뀌면 이전 값에서 새 값까지 굴러가듯 바뀌고, 바뀐 만큼 잠깐 보여줌
  const [shown, setShown] = useState(now);
  const [bump, setBump] = useState<{ d: number; key: number } | null>(null);
  const prevNow = useRef<number | null>(null);
  useEffect(() => {
    const from = prevNow.current;
    prevNow.current = now;
    if (from === null || from === now || !now) {
      setShown(now);
      return;
    }
    setBump({ d: now - from, key: Date.now() });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(now);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setShown(Math.round(from + (now - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [now]);
  useEffect(() => {
    if (!bump) return;
    const id = setTimeout(() => setBump(null), 5000);
    return () => clearTimeout(id);
  }, [bump]);
  const left = nextAt && clock ? Math.max(0, Math.ceil((nextAt - clock) / 1000)) : null;

  if (state === "off" && !points.length)
    return <p className="mt-3 text-sm text-muted">{t.liveUnavailable}</p>;
  if (!points.length)
    return <p className="mt-3 text-sm text-muted">{t.liveChecking}</p>;

  const last = points[points.length - 1];
  const lastT = new Date(last.at).getTime();
  // 1시간 전쯤(40~80분 전) 값들의 평균과 비교
  const hourAgo = points.filter((p) => {
    const d = lastT - new Date(p.at).getTime();
    return d >= 40 * 60_000 && d <= 80 * 60_000;
  });
  const prev = hourAgo.length
    ? Math.round(hourAgo.reduce((s, p) => s + p.estimate, 0) / hourAgo.length)
    : null;
  const diff = prev === null ? null : now - prev;

  const W = 320,
    H = 56;
  const t0 = new Date(points[0].at).getTime();
  const span = Math.max(1, lastT - t0);
  const hours = Math.max(1, Math.round(span / 3_600_000));
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(nl, { hour: "2-digit", minute: "2-digit" });
  const vals = points.map((p) => p.estimate);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : 2 + ((new Date(points[i].at).getTime() - t0) * (W - 6)) / span;
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (H - 8);
  const area = `M${x(0)},${H}` + points.map((p, i) => `L${x(i)},${y(p.estimate)}`).join("") + `L${x(points.length - 1)},${H}Z`;
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.estimate)}`)
    .join("");

  return (
    <div className="mt-3">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={`${big ? "text-6xl sm:text-7xl font-black" : "text-4xl font-bold"} tabular-nums leading-none`}
        >
          {shown.toLocaleString(nl)}
        </span>
        <span
          className={`${big ? "text-2xl" : "text-lg"} font-semibold text-muted`}
        >
          {t.playersUnit}
        </span>
        {bump && (
          <span
            key={bump.key}
            className={`fade-up whitespace-nowrap rounded-full px-2 py-0.5 ${big ? "text-sm" : "text-xs"} font-bold tabular-nums`}
            style={{
              color: bump.d > 0 ? "var(--chart-up)" : "var(--chart-down)",
              background: bump.d > 0 ? "rgba(57,135,229,0.15)" : "rgba(230,103,103,0.15)",
            }}
          >
            {t.liveJust} {bump.d > 0 ? "▲" : "▼"}
            {Math.abs(bump.d).toLocaleString(nl)}
          </span>
        )}
        {diff !== null && diff !== 0 && (
          <span
            className={`${big ? "text-lg" : "text-sm"} whitespace-nowrap font-semibold tabular-nums`}
            style={{
              color: diff > 0 ? "var(--chart-up)" : "var(--chart-down)",
            }}
          >
            {diff > 0 ? "▲" : "▼"}
            {Math.abs(diff).toLocaleString(nl)}
            <span className="ml-1 text-xs font-normal text-muted">{t.liveVsHour}</span>
          </span>
        )}
      </p>
      <p className="text-sm text-muted">
        {t.liveCaption()}
        {state === "off" && <> · {t.liveFromHistory}</>}
      </p>
      {state === "ok" && left !== null && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
          <span className="tabular-nums">{t.liveNext(left)}</span>
          <span className="h-0.5 w-16 overflow-hidden rounded bg-line">
            <span
              className="block h-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${100 - (left / (POLL_MS / 1000)) * 100}%` }}
            />
          </span>
        </div>
      )}
      {points.length > 1 && (
        <div className="mt-3 flex justify-between text-[11px] text-muted">
          <span>{t.liveRange(hours)}</span>
          <span className="tabular-nums">
            {min.toLocaleString(nl)} ~ {max.toLocaleString(nl)}
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`mt-1 w-full ${big ? "h-24" : "h-14"}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.liveAria}
      >
        <path d={area} fill="var(--chart-up)" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-up)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={p.at}
            cx={x(i)}
            cy={y(p.estimate)}
            r={i === points.length - 1 ? 3 : 0}
            className={i === points.length - 1 && state === "ok" ? "live-dot" : undefined}
            fill="var(--chart-up)"
          >
            <title>
              {t.livePointTitle(fmt(p.at), p.estimate)}
            </title>
          </circle>
        ))}
      </svg>
      {points.length > 1 && (
        <div className="flex justify-between text-[10px] tabular-nums text-muted">
          <span>{fmt(points[0].at)}</span>
          <span>{t.liveNow}</span>
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted">{t.liveFoot}</p>
    </div>
  );
}
