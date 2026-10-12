"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 페이지를 열어 둔 채로 있어도 새 데이터가 들어오면 반영되게 주기적으로 다시 불러옵니다
export default function AutoRefresh({ minutes = 5 }: { minutes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), minutes * 60_000);
    return () => clearInterval(id);
  }, [router, minutes]);
  return null;
}
