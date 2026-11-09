"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useRef, type ComponentProps } from "react";

// 화면에 보이는 링크를 전부 미리 불러오지는 않아요.
// Render 무료 서버는 CPU가 아주 작아서, 보이는 링크마다 미리 불러오면 그 계산 때문에 지금 페이지가 늦게 떠요.
// 대신 마우스를 잠깐 올리거나(0.08초) 손가락이 닿는 순간 그 페이지 하나만 미리 받아 둬서,
// 실제로 누를 때는 이미 와 있거나 거의 다 온 상태가 돼요. 서버가 만들어 둔 페이지(server.mjs)라 대부분 바로 와요.
const done = new Set<string>();

export default function Link({ prefetch = false, onMouseEnter, onMouseLeave, onTouchStart, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = typeof props.href === "string" ? props.href : null;

  const warm = () => {
    if (!href || !href.startsWith("/") || done.has(href)) return;
    done.add(href);
    // 2분 뒤엔 다시 받을 수 있게 (next.config staleTimes와 같은 시간)
    setTimeout(() => done.delete(href), 120_000);
    try {
      router.prefetch(href, { kind: PrefetchKind.FULL });
    } catch {
      // 미리 받기는 실패해도 괜찮아요
    }
  };

  return (
    <NextLink
      prefetch={prefetch}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(warm, 80);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        if (timer.current) clearTimeout(timer.current);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        warm();
      }}
      {...props}
    />
  );
}
