"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; label: string; href: string };

// 탭(라인·랭크·패치)은 화면에 보이면 미리 불러와 두고, 누르는 즉시 선택 표시를 옮겨요.
// 서버 응답을 기다리는 동안에도 반응이 바로 보여서 멈춘 것처럼 느껴지지 않아요
export default function Tabs({ items, active }: { items: Item[]; active: string }) {
  const [picked, setPicked] = useState(active);
  useEffect(() => setPicked(active), [active]);
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          prefetch
          scroll={false}
          onClick={() => setPicked(t.id)}
          aria-current={t.id === active ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
            t.id === picked ? "bg-accent font-semibold text-black" : "bg-panel-2 text-muted hover:text-text"
          }`}
        >
          <Label text={t.label} />
        </Link>
      ))}
    </div>
  );
}

function Label({ text }: { text: string }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "opacity-60" : undefined}>{text}</span>;
}
