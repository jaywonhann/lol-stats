"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dict, type Lang } from "@/lib/i18n";

// alt: 다른 언어의 챔피언 이름 (한국어/영어 어느 쪽으로도 검색되게)
type Entry = { id: string; name: string; alt?: string; icon: string };

export default function ChampionSearch({ champions, lang }: { champions: Entry[]; lang: Lang }) {
  const t = dict(lang);
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return champions;
    return champions.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term) ||
        (c.alt?.toLowerCase().includes(term) ?? false),
    );
  }, [q, champions]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="w-full rounded-lg border border-line bg-panel-2 px-4 py-3 text-base outline-none focus:border-accent"
      />
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {results.map((c) => (
          <Link key={c.id} href={`/champions/${c.id}`} className="group flex flex-col items-center gap-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.icon} alt={c.name} width={56} height={56} loading="lazy" style={{ width: 56, height: 56 }} className="overflow-hidden text-[0px] rounded-md group-hover:ring-2 group-hover:ring-accent" />
            <span className="w-full truncate text-xs text-muted group-hover:text-text">{c.name}</span>
          </Link>
        ))}
        {results.length === 0 && <p className="col-span-full text-sm text-muted">{t.noResults}</p>}
      </div>
    </div>
  );
}
