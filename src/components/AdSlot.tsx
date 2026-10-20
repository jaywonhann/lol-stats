"use client";
import { useEffect } from "react";

import { ADSENSE_CLIENT as CLIENT } from "@/lib/ads";

const SIZES = {
  banner: "h-[90px] w-full max-w-[728px]",
} as const;

// 광고 자리. NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-...)가 있으면 AdSense 광고, 없으면 자리 표시만.
export default function AdSlot({
  kind,
  slot,
  className = "",
}: {
  kind: keyof typeof SIZES;
  slot?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!CLIENT || !slot) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({});
    } catch {}
  }, [slot]);

  if (CLIENT && slot) {
    return (
      <div className={`ad-slot ${SIZES[kind]} overflow-hidden ${className}`}>
        <ins
          className="adsbygoogle block h-full w-full"
          data-ad-client={CLIENT}
          data-ad-slot={slot}
        />
      </div>
    );
  }
  return (
    <div
      className={`ad-slot ${SIZES[kind]} flex items-center justify-center rounded-md border border-dashed border-line text-[11px] text-muted ${className}`}
      aria-hidden
    >
      AD
    </div>
  );
}
