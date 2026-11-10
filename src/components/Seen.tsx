"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// 방문자 세기: 화면에서 실제로 손을 댔을 때(스크롤·터치·마우스·키보드) 한 번만 서버(server.mjs의 /__hit)에 알려요.
// 로봇은 페이지를 받아 가도 손을 대지는 않아서, 이렇게 해야 사람 수만 세져요.
// 보내는 건 지금 페이지 경로와 어느 사이트에서 왔는지(주소의 사이트 이름만)뿐이고, 쿠키나 개인 정보는 안 써요.
let first = true;

export default function Seen() {
  const pathname = usePathname();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === pathname) return;
    const events = ["pointerdown", "pointermove", "touchstart", "scroll", "keydown"] as const;
    const off = () => events.forEach((e) => window.removeEventListener(e, hit));
    function hit() {
      off();
      if (sent.current === pathname) return;
      sent.current = pathname;
      let ref = "";
      try {
        if (first && document.referrer) ref = new URL(document.referrer).hostname;
      } catch {
        // 주소를 못 읽으면 직접 방문으로 쳐요
      }
      const q = new URLSearchParams({ p: pathname });
      if (ref) q.set("r", ref);
      if (!first) q.set("n", "1");
      first = false;
      fetch(`/__hit?${q}`, { keepalive: true, cache: "no-store" }).catch(() => {});
    }
    events.forEach((e) => window.addEventListener(e, hit, { passive: true, once: true }));
    return off;
  }, [pathname]);

  return null;
}
