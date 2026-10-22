"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  kind: "post" | "comment";
  n?: number;
  cats?: { id: string; label: string }[];
  defaultCat?: string;
  labels: Record<"nick" | "title" | "body" | "send" | "sending" | "empty" | "blocked" | "slow" | "error" | "off", string>;
};

// 닉네임은 브라우저에만 기억해 둡니다
export default function CommunityForm({ kind, n, cats, defaultCat, labels }: Props) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState(defaultCat ?? "free");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      setNick(localStorage.getItem("nick") ?? "");
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      try {
        localStorage.setItem("nick", nick);
      } catch {}
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, n, cat, nick, title, body, website }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; n?: number };
      if (r.ok) {
        setBody("");
        setTitle("");
        if (kind === "post" && r.n) router.push(`/community/${r.n}`);
        else router.refresh();
      } else {
        setNote((labels as Record<string, string>)[r.reason ?? "error"] ?? labels.error);
      }
    } catch {
      setNote(labels.error);
    }
    setBusy(false);
  };

  const field = "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {kind === "post" && cats && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} !w-auto`}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} placeholder={labels.nick} className={`${field} !w-40`} />
        {kind === "post" && (
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={labels.title} className={`${field} min-w-0 flex-1`} />
        )}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={kind === "post" ? 5 : 3} placeholder={labels.body} className={field} />
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
          {busy ? labels.sending : labels.send}
        </button>
        {note && <span className="text-sm text-lose">{note}</span>}
      </div>
    </form>
  );
}
