"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { key: string; id: string; name: string; icon: string; n: number };

// 위 실시간 인원 숫자(LiveCounter가 보내는 값)를 챔피언별로 나눠서, 합계가 그 숫자와 똑같게 보여줍니다
function split(rows: Row[], total: number) {
  const picks = rows.reduce((s, r) => s + r.n, 0) || 1;
  const raw = rows.map((r) => (r.n / picks) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, v) => s + v, 0);
  // 소수점이 큰 순서대로 1명씩 더해서 합을 맞춤
  raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (left > 0) {
        out[i]++;
        left--;
      }
    });
  return out;
}

export default function LiveChampionsList({
  rows,
  initial,
  labels,
  nl,
}: {
  rows: Row[];
  initial: number;
  labels: { total: string; players: string; more: string; less: string; sum: string; waiting: string };
  nl: string;
}) {
  const [total, setTotal] = useState(initial);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (v > 0) setTotal(v);
    };
    window.addEventListener("livelol:now", on);
    const cur = (window as unknown as { livelolNow?: number }).livelolNow;
    if (cur && cur > 0) setTotal(cur);
    return () => window.removeEventListener("livelol:now", on);
  }, []);

  if (!total) return <p className="mt-2 text-sm text-muted">{labels.waiting}</p>;
  const counts = split(rows, total);
  const max = Math.max(1, ...counts);
  const shown = all ? rows : rows.slice(0, 10);
  const fmt = (n: number) => n.toLocaleString(nl);

  return (
    <>
      <p className="mb-3 text-sm">
        {labels.total.replace("{n}", fmt(total))}
      </p>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {shown.map((r, i) => (
          <li key={r.key}>
            <Link
              href={`/champions/${r.id}`}
              className="lift flex items-center gap-3 rounded-xl bg-panel p-3"
            >
              <span className="w-5 text-center text-sm font-bold tabular-nums text-muted">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.icon} alt={r.name} width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 overflow-hidden rounded text-[0px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.name}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded bg-panel-2">
                  <span
                    className="block h-full rounded bg-accent transition-[width] duration-700"
                    style={{ width: `${(counts[i] / max) * 100}%` }}
                  />
                </span>
                <span className="mt-0.5 block text-xs font-semibold tabular-nums">
                  {labels.players.replace("{n}", fmt(counts[i]))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{labels.sum.replace("{n}", String(rows.length)).replace("{total}", fmt(total))}</span>
        {rows.length > 10 && (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-accent hover:underline">
            {all ? labels.less : labels.more.replace("{n}", String(rows.length))}
          </button>
        )}
      </div>
    </>
  );
}
