"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dict, type Lang } from "@/lib/i18n";

// alt: 다른 언어의 챔피언 이름 (한국어/영어 어느 쪽으로도 검색되게)
type Entry = { id: string; name: string; alt?: string; icon: string; tags?: string[]; wr?: number; games?: number; lane?: string };

const TAGS: [string, string, string][] = [
  ["Fighter", "Fighter", "전사"],
  ["Tank", "Tank", "탱커"],
  ["Mage", "Mage", "마법사"],
  ["Assassin", "Assassin", "암살자"],
  ["Marksman", "Marksman", "원거리 딜러"],
  ["Support", "Support", "서포터"],
];

// base: 챔피언 링크 앞부분 (윈도우 앱 화면은 "/app?champ=")
export default function ChampionSearch({ champions, lang, base = "/champions/", filters = false }: { champions: Entry[]; lang: Lang; base?: string; filters?: boolean }) {
  const t = dict(lang);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [byWr, setByWr] = useState(false);
  const hasWr = champions.some((c) => c.wr !== undefined);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pool = tag ? champions.filter((c) => c.tags?.includes(tag)) : champions;
    const sorted = byWr ? [...pool].sort((a, b) => (b.wr ?? -1) - (a.wr ?? -1)) : pool;
    if (!term) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term) ||
        (c.alt?.toLowerCase().includes(term) ?? false),
    );
  }, [q, tag, byWr, champions]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="w-full rounded-lg border border-line bg-panel-2 px-4 py-3 text-base outline-none focus:border-accent"
      />
      {filters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map(([id, en, ko]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tag === id}
              onClick={() => setTag(tag === id ? null : id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${tag === id ? "border-accent bg-accent/15 text-text" : "border-line text-muted hover:text-text"}`}
            >
              {lang === "ko" ? ko : en}
            </button>
          ))}
          {hasWr && (
            <button
              type="button"
              aria-pressed={byWr}
              onClick={() => setByWr(!byWr)}
              className={`rounded-full border px-3 py-1.5 text-sm ${byWr ? "border-accent bg-accent/15 text-text" : "border-line text-muted hover:text-text"}`}
            >
              {lang === "ko" ? "승률 높은 순" : "Highest win rate"}
            </button>
          )}
        </div>
      )}
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {results.map((c) => (
          <Link key={c.id} href={`${base}${c.id}${c.lane ? `?lane=${c.lane}` : ""}`} className="group flex flex-col items-center gap-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.icon} alt={c.name} width={56} height={56} loading="lazy" style={{ width: 56, height: 56 }} className="overflow-hidden text-[0px] rounded-md group-hover:ring-2 group-hover:ring-accent" />
            <span className="w-full truncate text-xs text-muted group-hover:text-text">{c.name}</span>
            {c.wr !== undefined && <span className="text-xs tabular-nums text-muted">{c.wr.toFixed(1)}%</span>}
          </Link>
        ))}
        {results.length === 0 && <p className="col-span-full text-sm text-muted">{t.noResults}</p>}
      </div>
    </div>
  );
}
