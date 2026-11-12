"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { Icon } from "@/components/ui";
import { img } from "@/lib/ddragon";

// 게임 한 줄: 요약은 서버가 그려 주고, 10명 전체 기록은 눌렀을 때만 그려요.
// 예전에는 20판 × 10명 기록(아이콘 약 2,000개)을 처음부터 다 만들어서 전적 페이지가 1.7MB나 됐고, 무료 서버에서 다 받는 데 5초 넘게 걸렸어요.
export type DetailPlayer = {
  team: 100 | 200;
  win: boolean;
  me: boolean;
  name: string;
  href: string | null;
  champ: string; // 챔피언 이미지 파일 이름 (주소는 여기서 만들어요. 20판 × 10명 주소를 다 보내면 페이지가 커져서)
  champName: string;
  k: number;
  d: number;
  a: number;
  dmg: number;
  dmgPct: number;
  inbun: number;
  items: number[];
};

export default function GameRow({
  summaryClass,
  summary,
  players,
  labels,
  version,
}: {
  summaryClass: string;
  summary: React.ReactNode;
  players: DetailPlayer[];
  labels: { blue: string; red: string; win: string; loss: string; dmg: string };
  version: string | null;
}) {
  const [open, setOpen] = useState(false);
  const icon = (src: string | null, alt: string, size: number) =>
    src ? <Icon src={src} alt={alt} size={size} /> : <span className="shrink-0 rounded bg-panel-2" style={{ width: size, height: size }} />;
  return (
    <details className="group rounded-lg bg-panel" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className={summaryClass}>{summary}</summary>
      {open && (
        <div className="grid gap-3 border-t border-line p-3 md:grid-cols-2">
          {([100, 200] as const).map((team) => {
            const list = players.filter((p) => p.team === team);
            return (
              <div key={team}>
                <p className="mb-1 text-xs font-semibold text-muted">
                  {team === 100 ? labels.blue : labels.red} · {list[0]?.win ? labels.win : labels.loss}
                </p>
                <ul className="space-y-1.5">
                  {list.map((p, i) => (
                    <li key={i} className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${p.me ? "bg-accent/10" : ""}`}>
                      {icon(version ? img.champion(version, p.champ) : null, p.champName, 24)}
                      <span className="min-w-0 flex-1">
                        {p.href ? (
                          <Link href={p.href} className="block truncate hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="block truncate">{p.name}</span>
                        )}
                        <span className="block h-1 rounded bg-panel-2">
                          <span className="block h-1 rounded bg-accent" style={{ width: `${p.dmgPct}%` }} title={`${labels.dmg} ${p.dmg.toLocaleString()}`} />
                        </span>
                      </span>
                      <span className="w-14 shrink-0 text-right font-semibold">
                        {p.k}/{p.d}/{p.a}
                      </span>
                      <span className="hidden w-9 shrink-0 text-right text-muted sm:block">{p.inbun.toFixed(1)}</span>
                      <span className="hidden gap-0.5 lg:flex">
                        {p.items.map((id, j) => (id && version ? <Icon key={j} src={img.item(version, String(id))} alt="" size={16} /> : <span key={j} className="rounded bg-panel-2" style={{ width: 16, height: 16 }} />))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </details>
  );
}
