"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { dict, type Lang } from "@/lib/i18n";
import { SERVERS, serverLabel, type Server } from "@/lib/lanes";

export default function ServerSelect({ value, lang }: { value: Server; lang: Lang }) {
  const router = useRouter();
  const [refreshing, start] = useTransition();
  // 전적 페이지로 이동하는 동안에도 돌아가는 표시를 보여줘요. 새 서버로 그려지면(value가 바뀌면) 꺼요
  const [moving, setMoving] = useState(false);
  useEffect(() => setMoving(false), [value]);
  const pending = refreshing || moving;
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {dict(lang).server}
      <select
        value={value}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const next = e.target.value;
          document.cookie = `server=${next}; path=/; max-age=31536000; samesite=lax`;
          // 한국 서버는 한국어, 북미·유럽 서버는 영어로 바꿔요 (언어는 옆 메뉴에서 다시 바꿀 수 있어요)
          document.cookie = `lang=${next === "kr" ? "ko" : "en"}; path=/; max-age=31536000; samesite=lax`;
          // 전적·멀티서치 주소에 ?s=(공유 링크의 서버)가 있으면 그게 쿠키보다 우선이라, 예전엔 서버를 바꿔도 그대로였어요.
          // 주소의 서버도 같이 바꾸고, 새 주소로 이동해서 결과를 기다리는 동안 불러오는 화면이 바로 뜨게 해요.
          const { pathname, search } = window.location;
          const q = new URLSearchParams(search);
          if (q.has("s") || ((pathname === "/summoner" || pathname === "/multi") && q.toString())) {
            q.set("s", next);
            setMoving(true);
            router.push(`${pathname}?${q}`);
            return;
          }
          start(() => router.refresh());
        }}
        className="rounded-md border border-line bg-panel-2 px-2 py-1 text-text disabled:opacity-60"
      >
        {SERVERS.map((s) => (
          <option key={s.id} value={s.id}>
            {serverLabel(s.id, lang)}
          </option>
        ))}
      </select>
      {pending && <span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />}
    </label>
  );
}
