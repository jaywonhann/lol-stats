"use client";

import { useRouter } from "next/navigation";
import { SERVERS, type Server } from "@/lib/lanes";

export default function ServerSelect({ value }: { value: Server }) {
  const router = useRouter();
  return (
    <label className="ml-auto flex items-center gap-2 text-sm text-muted">
      서버
      <select
        value={value}
        onChange={(e) => {
          document.cookie = `server=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="rounded-md border border-line bg-panel-2 px-2 py-1 text-text"
      >
        {SERVERS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
