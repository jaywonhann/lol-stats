"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dict, LANGS, type Lang } from "@/lib/i18n";

const setCookie = (v: string) => {
  document.cookie = `lang=${v}; path=/; max-age=31536000; samesite=lax`;
};

export default function LangSelect({ value }: { value: Lang }) {
  const router = useRouter();
  // 검색 결과의 ?lang=ko 주소로 들어오면 그 언어를 기억해서, 다른 페이지로 가도 같은 언어로 보여요
  useEffect(() => {
    const p = new URLSearchParams(location.search).get("lang");
    if ((p === "ko" || p === "en") && !document.cookie.includes(`lang=${p}`)) setCookie(p);
  }, []);
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <select
        value={value}
        aria-label={dict(value).language}
        onChange={(e) => {
          setCookie(e.target.value);
          // 주소에 ?lang= 이 있으면 그게 쿠키보다 앞서니까 빼고 다시 열어요
          const u = new URL(location.href);
          if (u.searchParams.has("lang")) {
            u.searchParams.delete("lang");
            location.replace(u.toString());
          } else router.refresh();
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
