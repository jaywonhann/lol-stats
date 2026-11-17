"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// 휴대폰 홈 화면(또는 PC 바탕화면)에 사이트 아이콘을 추가하는 버튼.
// 브라우저가 "추가할 수 있다"고 알려 줄 때만 보여요 (안드로이드·PC 크롬/엣지. 아이폰 사파리는 이 신호가 없어서 안 보여요).
export default function InstallButton({ label }: { label: string }) {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    const off = () => setEv(null);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", off);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", off);
    };
  }, []);
  if (!ev) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          navigator.sendBeacon?.("/__hit?e=install");
          await ev.prompt();
          await ev.userChoice;
        } catch {
          // 창을 닫은 경우 등은 무시
        }
        setEv(null);
      }}
      className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-text hover:bg-panel-2"
    >
      {label}
    </button>
  );
}
