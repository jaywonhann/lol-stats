"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 링크를 누르는 순간 화면 맨 위에 진행 막대를 띄워요.
// 서버가 다음 페이지를 만드는 동안(처음 여는 페이지는 1~3초) 눌린 게 맞는지 바로 알 수 있게.
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setOn(true);
      // 혹시 이동이 안 되면 10초 뒤 저절로 사라져요
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOn(false), 10_000);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  // 주소가 바뀌면(새 페이지가 그려지면) 막대를 내려요
  useEffect(() => {
    setOn(false);
    if (timer.current) clearTimeout(timer.current);
  }, [pathname, search]);

  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div className="nav-progress h-full bg-accent" />
    </div>
  );
}
