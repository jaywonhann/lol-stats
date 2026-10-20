"use client";

import { useEffect, useState } from "react";
import { dict, type Lang } from "@/lib/i18n";

type RunePayload = { name: string; primaryStyleId: number; subStyleId: number; selectedPerkIds: number[] };
type Result = { ok: boolean; reason?: string };
type Bridge = { applyRunes: (p: RunePayload) => Promise<Result>; applySpells: (ids: number[]) => Promise<Result> };

// 윈도우 앱 안에서만 보이는 "룬·스펠 적용" 버튼 (일반 브라우저에서는 아무것도 그리지 않음)
export default function ApplyButtons({ lang, runes, spells }: { lang: Lang; runes: RunePayload | null; spells: number[] | null }) {
  const t = dict(lang).app;
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const b = (window as unknown as { livelolApp?: Bridge }).livelolApp;
    if (b) setBridge(b);
  }, []);
  if (!bridge) return null;

  const reason = (r?: string) =>
    r === "noclient" ? t.applyNoClient : r === "full" ? t.applyFull : r === "notselect" ? t.applyNotSelect : t.applyError;
  async function run(kind: "runes" | "spells") {
    if (!bridge || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = kind === "runes" ? await bridge.applyRunes(runes!) : await bridge.applySpells(spells!);
      setMsg(r.ok ? (kind === "runes" ? t.applyOk : t.applySpellsOk) : reason(r.reason));
    } catch {
      setMsg(t.applyError);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <p className="mb-2 text-xs font-semibold text-muted">{t.applyTitle}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!runes || busy}
          onClick={() => run("runes")}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-40"
        >
          {t.applyRunes}
        </button>
        <button
          type="button"
          disabled={!spells || busy}
          onClick={() => run("spells")}
          className="rounded-md bg-panel-2 px-3 py-1.5 text-sm font-bold transition hover:bg-line disabled:opacity-40"
        >
          {t.applySpells}
        </button>
      </div>
      {runes && runes.selectedPerkIds.length === 6 && <p className="mt-2 text-xs text-muted">{t.applyNoShards}</p>}
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </div>
  );
}
