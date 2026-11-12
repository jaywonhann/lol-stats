"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 공유 링크(?s=)로 다른 서버의 전적을 열면, 위쪽 서버 선택도 그 서버로 맞춰요.
// 예전에는 위에는 "북미"인데 페이지는 "한국"으로 찾는 식으로 둘이 어긋나서 헷갈렸어요.
export default function SyncServer({ server }: { server: string }) {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `server=${server}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [server, router]);
  return null;
}
