"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Live = { server: string; who: string; label: string; kind: string; champ: number; start: number; queue: number };
type Reply =
  | { available: true; total: number; checked: number; live: Live[]; at: string }
  | { available: false; reason: string };
type Champ = { name: string; icon: string; id: string };

const QUEUES: Record<number, [string, string]> = {
  420: ["솔로랭크", "Ranked Solo"],
  440: ["자유랭크", "Ranked Flex"],
  400: ["일반", "Normal"],
  430: ["일반", "Normal"],
  450: ["칼바람", "ARAM"],
};

// 지금 게임 중인 프로·스트리머·챌린저 (1분마다 새로 확인)
export default function ProsLive({ champs, ko }: { champs: Record<string, Champ>; ko: boolean }) {
  const [r, setR] = useState<Reply | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = (await (await fetch("/api/pros-live")).json()) as Reply;
        if (!stop) setR(d);
      } catch {
        if (!stop) setR({ available: false, reason: "error" });
      }
    };
    tick();
    const a = setInterval(tick, 60_000);
    const b = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      stop = true;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  if (!r) return <p className="text-sm text-muted">{ko ? "확인하는 중…" : "Checking…"}</p>;
  if (!r.available)
    return <p className="text-sm text-muted">{ko ? "지금은 확인할 수 없어요. 잠시 뒤에 다시 와 주세요." : "Not available right now. Please check back soon."}</p>;
  const sorted = [...r.live].sort((a, b) => (a.kind === "challenger" ? 1 : 0) - (b.kind === "challenger" ? 1 : 0) || a.start - b.start);
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        {ko
          ? `등록된 ${r.total.toLocaleString()}개 계정을 돌려가며 확인해요. 최근 10분 안에 확인한 ${r.checked.toLocaleString()}개 중 ${sorted.length}명이 게임 중이에요.`
          : `We rotate through ${r.total.toLocaleString()} accounts. Of ${r.checked.toLocaleString()} checked in the last 10 min, ${sorted.length} are in a game.`}
      </p>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">{ko ? "지금 확인된 게임이 없어요. 계속 확인하고 있어요." : "No live games found yet. Still checking."}</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {sorted.map((p) => {
            const c = champs[String(p.champ)];
            const min = p.start > 0 ? Math.max(0, Math.floor((now - p.start) / 60_000)) : null;
            return (
              <li key={`${p.server}-${p.who}`} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-3">
                {c && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt={c.name} width={40} height={40} className="rounded-md" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/summoner?id=${encodeURIComponent(p.who)}`} className="block truncate font-semibold hover:underline">
                    <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                    {p.label}
                  </Link>
                  <span className="text-xs text-muted">
                    {c ? <Link href={`/champions/${c.id}`} className="hover:underline">{c.name}</Link> : null}
                    {" · "}
                    {QUEUES[p.queue]?.[ko ? 0 : 1] ?? (ko ? "기타" : "Other")}
                    {" · "}
                    {p.server.toUpperCase()}
                    {min !== null && ` · ${min}${ko ? "분째" : " min"}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
