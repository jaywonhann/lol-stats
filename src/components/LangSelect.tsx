"use client";

import { useRouter } from "next/navigation";
import { dict, LANGS, type Lang } from "@/lib/i18n";

export default function LangSelect({ value }: { value: Lang }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <select
        value={value}
        aria-label={dict(value).language}
        onChange={(e) => {
          document.cookie = `lang=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="rounded-md border border-line bg-panel-2 px-2 py-1 text-text"
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
