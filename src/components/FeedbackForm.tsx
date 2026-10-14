"use client";

import { useEffect, useState } from "react";

type Labels = {
  title: string;
  intro: string;
  ratingLabel: string;
  good: string;
  okay: string;
  bad: string;
  message: string;
  messagePlaceholder: string;
  contact: string;
  contactPlaceholder: string;
  send: string;
  sending: string;
  thanks: string;
  empty: string;
  off: string;
  slow: string;
  error: string;
  privacy: string;
};

// 사이트 피드백 양식 (/api/feedback 으로 보냄)
export default function FeedbackForm({ lang, labels }: { lang: string; labels: Labels }) {
  const [rating, setRating] = useState<"good" | "okay" | "bad" | null>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((r: { available?: boolean }) => setAvailable(!!r.available))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating && !message.trim()) return setNote(labels.empty);
    setState("sending");
    setNote(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message, contact, website, lang, page: document.referrer || location.pathname }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (r.ok) {
        setState("done");
        return;
      }
      setNote(r.reason === "off" ? labels.off : r.reason === "slow" ? labels.slow : r.reason === "empty" ? labels.empty : labels.error);
    } catch {
      setNote(labels.error);
    }
    setState("idle");
  };

  if (state === "done")
    return (
      <div className="rounded-lg bg-panel-2 p-6 text-center">
        <p className="text-2xl">🙏</p>
        <p className="mt-2 text-lg font-semibold">{labels.thanks}</p>
      </div>
    );

  const choices = [
    ["good", "😀", labels.good],
    ["okay", "😐", labels.okay],
    ["bad", "😞", labels.bad],
  ] as const;

  return (
    <form onSubmit={submit} className="space-y-4">
      {!available && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{labels.off}</p>}
      <fieldset>
        <legend className="text-sm font-medium">{labels.ratingLabel}</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {choices.map(([v, emoji, text]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRating(v)}
              aria-pressed={rating === v}
              className={`rounded-lg border px-2 py-3 text-center transition ${
                rating === v ? "border-accent bg-accent/15" : "border-line bg-panel-2 hover:border-muted"
              }`}
            >
              <span className="block text-2xl">{emoji}</span>
              <span className="mt-1 block text-sm">{text}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium">{labels.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder={labels.messagePlaceholder}
          className="mt-2 w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{labels.contact}</span>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          placeholder={labels.contactPlaceholder}
          className="mt-2 h-10 w-full rounded-md border border-line bg-panel-2 px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>
      {/* 사람에게는 안 보이는 칸 (봇이 채우면 무시) */}
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
        name="website"
      />
      {note && (
        <p role="alert" className="text-sm text-lose">
          {note}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{labels.privacy}</p>
        <button
          type="submit"
          disabled={state === "sending" || !available}
          className="h-11 rounded-md bg-accent px-6 font-semibold text-black hover:brightness-110 disabled:opacity-50"
        >
          {state === "sending" ? labels.sending : labels.send}
        </button>
      </div>
    </form>
  );
}
