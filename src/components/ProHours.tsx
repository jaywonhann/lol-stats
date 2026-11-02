"use client";

import { useEffect, useState } from "react";
import WinBars from "@/components/WinBars";
import { byHour } from "@/lib/deep";
import { proText } from "@/lib/pro-text";
import type { Lang } from "@/lib/i18n";

// 시간대 승률은 보는 사람의 시간대로 계산해야 해서 브라우저에서 그려요
export default function ProHours({ hours, lang }: { hours: { t: number; w: boolean }[]; lang: Lang }) {
  const p = proText(lang);
  const [h, setH] = useState<ReturnType<typeof byHour> | null>(null);
  useEffect(() => setH(byHour(hours)), [hours]);
  if (!h) return <div className="h-40" aria-busy />;
  return (
    <div className="space-y-3">
      <WinBars rows={h.buckets.map((b, i) => ({ label: p.hourLabels[i], n: b.n, rate: b.rate }))} gamesN={p.gamesN} few={p.few} />
      {(h.best !== null || h.worst !== null) && (
        <p className="text-sm font-medium">
          {h.best !== null && p.rule.hourBest(p.hourNames[h.best], h.buckets[h.best].rate!.toFixed(0))}{" "}
          {h.worst !== null && p.rule.hourWorst(p.hourNames[h.worst], h.buckets[h.worst].rate!.toFixed(0))}
        </p>
      )}
    </div>
  );
}
