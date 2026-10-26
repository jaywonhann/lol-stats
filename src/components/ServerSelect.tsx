"use client";

import { useRouter } from "next/navigation";
import { dict, type Lang } from "@/lib/i18n";
import { SERVERS, serverLabel, type Server } from "@/lib/lanes";

export default function ServerSelect({ value, lang }: { value: Server; lang: Lang }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {dict(lang).server}
      <select
        value={value}
        onChange={(e) => {
          document.cookie = `server=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          // 한국 서버는 한국어, 북미·유럽 서버는 영어로 바꿔요 (언어는 옆 메뉴에서 다시 바꿀 수 있어요)
          document.cookie = `lang=${e.target.value === "kr" ? "ko" : "en"}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="rounded-md border border-line bg-panel-2 px-2 py-1 text-text"
      >
        {SERVERS.map((s) => (
          <option key={s.id} value={s.id}>
            {serverLabel(s.id, lang)}
          </option>
        ))}
      </select>
    </label>
  );
}
