"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { proText } from "@/lib/pro-text";
import type { Lang } from "@/lib/i18n";

// 라이선스 키 넣기 / 이 기기에서 해제
export default function ProUnlock({ lang, active }: { lang: Lang; active: boolean }) {
  const p = proText(lang);
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      setMsg({ ok: Boolean(j.ok), text: j.ok ? p.msg.ok : p.msg[j.reason ?? "invalid"] ?? p.msg.invalid });
      if (j.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: p.msg.unavailable });
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    await fetch("/api/pro", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setMsg(null);
    router.refresh();
  };

  if (active)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold" style={{ color: "var(--chart-up)" }}>
          ✓ {p.active}
        </p>
        <button type="button" onClick={remove} disabled={busy} className="text-xs text-muted underline hover:text-text">
          {p.remove}
        </button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="pro-key" className="block text-sm text-muted">
        {p.keyLabel}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="pro-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={p.keyPh}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-lg border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-60">
          {busy ? p.unlocking : p.unlock}
        </button>
      </div>
      {msg && (
        <p role="status" className="text-sm" style={{ color: msg.ok ? "var(--chart-up)" : "var(--chart-down)" }}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
