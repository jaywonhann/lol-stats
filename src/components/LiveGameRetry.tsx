"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";

// 소환사 페이지를 열 때 Riot 요청 한도에 걸리면 "지금 게임 중" 칸을 확인하지 못해요.
// 그럴 때 칸을 그냥 빼 버리지 않고, 6초·15초 뒤 두 번 다시 확인해요 (페이지만 새로 받고 스크롤은 그대로).
const DELAYS = [6_000, 15_000];
// 소환사마다 따로 세요 (새로 고침해도 컴포넌트가 다시 만들어져서 바깥에 둬요)
const tries = new Map<string, number>();

export default function LiveGameRetry({ lang, puuid }: { lang: Lang; puuid: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState((tries.get(puuid) ?? 0) >= DELAYS.length);
  const ko = lang === "ko";

  useEffect(() => {
    const n = tries.get(puuid) ?? 0;
    if (n >= DELAYS.length) return;
    const t = setTimeout(() => {
      tries.set(puuid, n + 1);
      router.refresh();
      if (n + 1 >= DELAYS.length) setGaveUp(true);
    }, DELAYS[n]);
    return () => clearTimeout(t);
  }, [router, puuid]);

  if (gaveUp)
    return (
      <p className="text-xs text-muted">
        {ko ? "지금 게임 중인지 확인하지 못했어요. 잠시 뒤 새로 고침해 보세요." : "Couldn't check whether this player is in a game. Try refreshing in a moment."}
      </p>
    );
  return (
    <p className="text-xs text-muted" aria-live="polite">
      {ko ? "지금 게임 중인지 확인하는 중…" : "Checking whether this player is in a game…"}
    </p>
  );
}
