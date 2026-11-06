"use client";

import { useEffect, useRef, useState } from "react";

type B = { id: string; icon: string; name: string };

// 지난번에 이 소환사를 봤을 때 이후로 새로 딴 배지가 있으면 축하 배너를 띄워요.
// 기록은 이 브라우저에만 남아요 (처음 볼 때는 비교할 게 없어서 조용히 저장만 해요).
export default function NewBadges({ who, earned, ko }: { who: string; earned: B[]; ko: boolean }) {
  const [fresh, setFresh] = useState<B[]>([]);
  const done = useRef(false);
  useEffect(() => {
    // 한 번만 비교해요 (두 번 돌면 방금 저장한 걸 보고 배너가 사라져요)
    if (done.current) return;
    done.current = true;
    const key = `livelol:badges:${who.toLowerCase()}`;
    try {
      const raw = localStorage.getItem(key);
      const seen: string[] | null = raw ? JSON.parse(raw) : null;
      if (seen) setFresh(earned.filter((b) => !seen.includes(b.id)));
      // 지금 가진 배지 + 예전에 봤던 배지 (최근 경기에서 밀려나도 다시 "새 배지"로 뜨지 않게)
      localStorage.setItem(key, JSON.stringify([...new Set([...(seen ?? []), ...earned.map((b) => b.id)])]));
    } catch {
      // 저장소를 못 쓰는 브라우저면 배너 없이 넘어가요
    }
  }, [who, earned]);
  if (fresh.length === 0) return null;
  return (
    <div role="status" className="badge-pop mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-accent/15 px-3 py-2 text-sm">
      <span className="text-lg" aria-hidden>🎉</span>
      <span className="font-bold text-accent">
        {ko ? `지난번 이후 새 배지 ${fresh.length}개!` : `${fresh.length} new badge${fresh.length > 1 ? "s" : ""} since your last visit!`}
      </span>
      {fresh.map((b) => (
        <span key={b.id} className="rounded-full bg-bg/60 px-2 py-0.5 font-semibold">
          {b.icon} {b.name}
        </span>
      ))}
    </div>
  );
}
