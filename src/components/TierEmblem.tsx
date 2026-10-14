"use client";

import { useEffect, useRef, useState } from "react";

// 롤 클라이언트 랭크 엠블럼 (public/emblems, fetch-emblems 워크플로가 받아 둠). 없으면 티어 색 방패로 대신 보여준다.
const FALLBACK: Record<string, string> = {
  IRON: "#7a6f69",
  BRONZE: "#a0623a",
  SILVER: "#9fb0bf",
  GOLD: "#e2b54a",
  PLATINUM: "#4fb8a8",
  EMERALD: "#2fbf71",
  DIAMOND: "#6fa8ff",
  MASTER: "#b660e0",
  GRANDMASTER: "#e05555",
  CHALLENGER: "#f2c94c",
};

export default function TierEmblem({ tier, size = 112 }: { tier: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // 하이드레이션 전에 이미 실패한 이미지도 잡는다
  useEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const color = FALLBACK[tier] ?? "#5b6475";
  if (failed || !FALLBACK[tier])
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
        <path d="M50 6 88 22v28c0 22-16 38-38 44C28 88 12 72 12 50V22z" fill={color} opacity="0.25" stroke={color} strokeWidth="4" />
        <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="700" fill={color}>
          {tier.charAt(0)}
        </text>
      </svg>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={`/emblems/${tier.toLowerCase()}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      style={{ width: size, height: size }}
    />
  );
}
