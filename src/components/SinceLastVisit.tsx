"use client";

import { useEffect, useState } from "react";

// 서버 컴포넌트에서 함수는 못 넘겨서 since 는 "{date}" 자리표시자가 든 문자열로 받아요
// 다시 검색했을 때 "지난번보다" 달라진 점을 보여줘요. 기록은 이 브라우저에만 저장돼요
type Snap = { at: number; last: number; wr: number; kda: number; cs: number };
type Labels = { title: string; since: string; wr: string; kda: string; cs: string; same: string; better: string; worse: string };

export default function SinceLastVisit({ id, now, labels, locale }: { id: string; now: Omit<Snap, "at">; labels: Labels; locale: string }) {
  const [prev, setPrev] = useState<Snap | null>(null);
  useEffect(() => {
    const key = `livelol:snap:${id}`;
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? "null") as Snap | null;
      // 새 게임이 생겼을 때만 비교하고, 그때 기록을 새로 저장해요
      if (old && old.last !== now.last) setPrev(old);
      if (!old || old.last !== now.last) localStorage.setItem(key, JSON.stringify({ ...now, at: Date.now() }));
    } catch {
      // 저장소를 못 쓰는 브라우저면 그냥 숨겨요
    }
  }, [id, now]);
  if (!prev) return null;
  const rows = [
    { label: labels.wr, d: now.wr - prev.wr, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%p`, min: 1 },
    { label: labels.kda, d: now.kda - prev.kda, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`, min: 0.05 },
    { label: labels.cs, d: now.cs - prev.cs, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`, min: 0.1 },
  ];
  const date = new Date(prev.at).toLocaleDateString(locale, { month: "short", day: "numeric" });
  return (
    <section className="rounded-xl bg-panel p-5">
      <h2 className="text-base font-bold">{labels.title}</h2>
      <p className="mt-1 text-xs text-muted">{labels.since.replace("{date}", date)}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {rows.map((r) => {
          const tone = Math.abs(r.d) < r.min ? 0 : r.d > 0 ? 1 : -1;
          return (
            <li key={r.label} className="rounded-lg bg-panel-2 px-3 py-2">
              <p className="text-xs text-muted">{r.label}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: tone > 0 ? "var(--chart-up)" : tone < 0 ? "var(--chart-down)" : undefined }}>
                {tone === 0 ? labels.same : `${tone > 0 ? "▲" : "▼"} ${r.fmt(r.d)}`}
              </p>
              <p className="text-xs text-muted">{tone > 0 ? labels.better : tone < 0 ? labels.worse : ""}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
