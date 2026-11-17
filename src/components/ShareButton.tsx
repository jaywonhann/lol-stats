"use client";

import { useState } from "react";

// 지금 페이지 링크를 공유해요. 휴대폰은 공유 창, 데스크톱은 링크 복사
// text: 링크 앞에 붙는 한 줄 (결과 요약). kind: 어떤 카드에서 눌렀는지 세는 이름 (server.mjs의 ev)
export default function ShareButton({ url, title, label, copied, text, kind }: { url: string; title: string; label: string; copied: string; text?: string; kind?: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const full = new URL(url, location.origin).toString();
    if (kind) {
      try {
        navigator.sendBeacon?.(`/__hit?e=${encodeURIComponent(`share-${kind}`)}`);
      } catch {
        // 세는 건 실패해도 공유는 계속
      }
    }
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share(text ? { title, text, url: full } : { title, url: full });
        return;
      }
      await navigator.clipboard.writeText(text ? `${text}\n${full}` : full);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // 사용자가 공유 창을 닫은 경우 등은 무시
    }
  };
  return (
    <button type="button" onClick={share} className="rounded-lg border border-accent/60 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10" aria-live="polite">
      {done ? copied : label}
    </button>
  );
}
