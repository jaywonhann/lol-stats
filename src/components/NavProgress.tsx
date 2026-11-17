"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 링크를 누르는 순간 화면 맨 위에 진행 막대를 띄워요.
// 서버가 다음 페이지를 만드는 동안(처음 여는 페이지는 1~3초) 눌린 게 맞는지 바로 알 수 있게.
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [on, setOn] = useState(false);
  // 서버 답이 0.25초 안에 안 오면, 이전 화면을 치우고 다음 화면의 뼈대를 바로 보여 줘요.
  // (2026-11-17 Jaywon: 눌러도 이전 화면이 그대로라 "안 넘어간다"고 느꼈어요. 무료 서버는 새 페이지를 만드는 데 1~6초 걸려요.)
  const [cover, setCover] = useState<{ who: string | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const begin = (url: URL) => {
    setOn(true);
    // 혹시 이동이 안 되면 15초 뒤 저절로 원래 화면으로 돌아와요
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOn(false);
      setCover(null);
    }, 15_000);
    if (coverTimer.current) clearTimeout(coverTimer.current);
    const who = url.pathname === "/summoner" ? url.searchParams.get("id") : null;
    coverTimer.current = setTimeout(() => {
      setCover({ who });
      if (window.scrollY > 0) window.scrollTo(0, 0);
    }, 250);
  };

  useEffect(() => {
    const click = (e: MouseEvent) => {
      // Next 링크는 누르면 기본 동작을 막고(preventDefault) 직접 옮겨서, 그보다 먼저(capture) 봐요
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // 같은 페이지 안의 #이동이나 지금 주소 그대로면 안 띄워요
      if (url.pathname === location.pathname && url.search === location.search) return;
      begin(url);
    };
    // 소환사 검색처럼 같은 사이트로 보내는 검색창을 제출할 때도 막대를 띄워요
    const submit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement | null;
      if (!f || f.target === "_blank") return;
      const url = new URL(f.action, location.href);
      if (url.origin !== location.origin) return;
      url.search = new URLSearchParams(new FormData(f) as unknown as Record<string, string>).toString();
      // 지금 보고 있는 결과를 다시 검색하면 주소가 안 바뀌어서 막대를 안 띄워요
      if (url.pathname === location.pathname && url.search === location.search) return;
      begin(url);
    };
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
    };
  }, []);

  // 주소가 바뀌면(새 페이지가 그려지면) 막대를 내려요
  useEffect(() => {
    setOn(false);
    setCover(null);
    if (timer.current) clearTimeout(timer.current);
    if (coverTimer.current) clearTimeout(coverTimer.current);
  }, [pathname, search]);

  // 뼈대를 보여 주는 동안 이전 화면 내용은 숨겨요 (globals.css의 #main.nav-pending)
  const main = cover && typeof document !== "undefined" ? document.getElementById("main") : null;
  useEffect(() => {
    if (!main) return;
    main.classList.add("nav-pending");
    return () => main.classList.remove("nav-pending");
  }, [main]);

  if (!on) return null;
  const ko = typeof document !== "undefined" && document.documentElement.lang.startsWith("ko");
  const bar = "animate-pulse rounded-lg bg-panel";
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
        <div className="nav-progress h-full bg-accent" />
      </div>
      {main &&
        cover &&
        createPortal(
          <div className="nav-skeleton space-y-4" role="status">
            <p className="text-sm text-muted">
              {cover.who ? (ko ? `${cover.who} 전적을 불러오는 중이에요…` : `Loading ${cover.who}…`) : ko ? "불러오는 중이에요…" : "Loading…"}
            </p>
            {cover.who ? (
              <>
                <div className={`${bar} h-24`} />
                <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className={`${bar} h-28`} />
                    <div className={`${bar} h-36`} />
                  </div>
                  <div className="space-y-4">
                    <div className={`${bar} h-40`} />
                    <div className={`${bar} h-24`} />
                    <div className={`${bar} h-24`} />
                    <div className={`${bar} h-24`} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`${bar} h-8 w-56`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`${bar} h-48`} />
                  <div className={`${bar} h-48`} />
                </div>
                <div className={`${bar} h-72`} />
              </>
            )}
          </div>,
          main,
        )}
    </>
  );
}
