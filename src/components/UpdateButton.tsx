"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

// op.gg처럼 "업데이트"를 누르면 이 소환사 데이터를 Riot에서 새로 받아 옵니다
export default function UpdateButton({
  id,
  server,
  fetchedAt,
  labels,
}: {
  id: string;
  server: string;
  fetchedAt: number;
  labels: { update: string; updating: string; updatedAgo: string; failed: string; wait: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // 방금 받아온 데이터면 60초 동안은 다시 못 누르게
  useEffect(() => {
    const left = Math.ceil((fetchedAt + 60_000 - Date.now()) / 1000);
    setWait(left > 0 ? left : 0);
  }, [fetchedAt]);

  const click = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/summoner/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, server }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; wait?: number };
      if (r.ok) start(() => router.refresh());
      else if (r.wait) setWait(r.wait);
      else setNote(labels.failed);
    } catch {
      setNote(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  const loading = busy || pending;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={click}
        disabled={loading || wait > 0}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden className={loading ? "inline-block animate-spin" : ""}>
          ↻
        </span>
        {loading ? labels.updating : labels.update}
      </button>
      <span className="text-xs text-muted" aria-live="polite">
        {note ?? (wait > 0 && !loading ? labels.wait.replace("-1", String(wait)) : labels.updatedAgo)}
      </span>
    </div>
  );
}
