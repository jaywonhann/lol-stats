"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 첫 화면 검색창 아래에 최근에 본 전적을 바로가기로 보여줘요. 두 번째 방문부터는 한 번 눌러서 내 전적으로 가요
export default function RecentSummoners({ label }: { label: string }) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("livelol.recent") ?? "[]");
      if (Array.isArray(v)) setList(v.filter((x) => typeof x === "string").slice(0, 3));
    } catch {
      // 저장소를 못 쓰면 숨겨요
    }
  }, []);
  if (!list.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-muted">{label}</span>
      {list.map((id) => (
        <Link
          key={id}
          href={`/summoner?id=${encodeURIComponent(id)}`}
          className="rounded-full border border-line bg-panel-2 px-3 py-1 font-semibold hover:border-accent"
        >
          {id}
        </Link>
      ))}
    </div>
  );
}
