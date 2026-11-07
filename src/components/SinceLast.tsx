"use client";

import { useEffect, useRef, useState } from "react";

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIV: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };
// 티어·단계·LP를 한 줄 점수로 (단계 하나 = 100LP, 마스터부터는 LP 그대로 이어서)
const score = (tier: string, rank: string, lp: number) => {
  const i = TIERS.indexOf(tier);
  if (i < 0) return null;
  return i >= 7 ? 7 * 400 + lp : i * 400 + (DIV[rank] ?? 0) * 100 + lp;
};

type Snap = { s: number; w: number; l: number; at: number };

// 지난번에 이 소환사를 봤을 때보다 LP가 얼마나 바뀌었는지, 그 사이 몇 승 몇 패인지.
// 기록은 이 브라우저에만 남아요 (처음 볼 때는 저장만 해요).
export default function SinceLast({ who, tier, rank, lp, wins, losses, ko }: { who: string; tier: string; rank: string; lp: number; wins: number; losses: number; ko: boolean }) {
  const [diff, setDiff] = useState<{ d: number; w: number; l: number; ago: string } | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const s = score(tier, rank, lp);
    if (s === null) return;
    const key = `livelol:rank:${who.toLowerCase()}`;
    try {
      const raw = localStorage.getItem(key);
      const old: Snap | null = raw ? JSON.parse(raw) : null;
      const w = old ? wins - old.w : 0;
      const l = old ? losses - old.l : 0;
      // 그 사이 게임을 했을 때만 보여 주고, 기록은 바뀌었을 때만 새로 저장해요 (같은 날 여러 번 봐도 비교 기준이 유지되게)
      if (old && (w > 0 || l > 0) && w >= 0 && l >= 0) {
        const min = Math.round((Date.now() - old.at) / 60_000);
        const ago =
          min < 60 ? (ko ? `${min}분 전` : `${min}m ago`) : min < 1440 ? (ko ? `${Math.round(min / 60)}시간 전` : `${Math.round(min / 60)}h ago`) : ko ? `${Math.round(min / 1440)}일 전` : `${Math.round(min / 1440)}d ago`;
        setDiff({ d: s - old.s, w, l, ago });
      }
      if (!old || w !== 0 || l !== 0) localStorage.setItem(key, JSON.stringify({ s, w: wins, l: losses, at: Date.now() } satisfies Snap));
    } catch {
      // 저장소를 못 쓰면 조용히 넘어가요
    }
  }, [who, tier, rank, lp, wins, losses, ko]);
  if (!diff) return null;
  const up = diff.d >= 0;
  return (
    <p className="badge-pop mt-1 text-xs">
      <span className={`font-bold tabular-nums ${up ? "text-win" : "text-lose"}`}>
        {up ? "▲" : "▼"} {up ? "+" : "−"}
        {Math.abs(diff.d)} LP
      </span>{" "}
      <span className="text-muted">
        {ko ? `지난번(${diff.ago})보다 · ${diff.w}승 ${diff.l}패` : `since last visit (${diff.ago}) · ${diff.w}W ${diff.l}L`}
      </span>
    </p>
  );
}
