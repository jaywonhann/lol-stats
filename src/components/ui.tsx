import Link from "next/link";
import { dict, type Lang } from "@/lib/i18n";
import type { Tier } from "@/lib/mock";

export function Icon({ src, alt, size = 32, className = "" }: { src: string; alt: string; size?: number; className?: string }) {
  // Data Dragon 이미지는 CDN에서 바로 불러옵니다
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} title={alt} width={size} height={size} loading="lazy" style={{ width: size, height: size }} className={`shrink-0 overflow-hidden rounded object-cover text-[0px] ${className}`} />;
}

const TIER_STYLE: Record<Tier, string> = {
  OP: "bg-rose-500 text-white",
  "1": "bg-orange-500 text-white",
  "2": "bg-amber-400 text-black",
  "3": "bg-teal-500 text-white",
  "4": "bg-slate-500 text-white",
  "5": "bg-slate-700 text-slate-300",
};

export function TierBadge({ tier, lang }: { tier: Tier; lang: Lang }) {
  return (
    <span className={`inline-flex h-6 min-w-8 items-center justify-center rounded px-1.5 text-xs font-bold ${TIER_STYLE[tier]}`}>
      {dict(lang).tier(tier)}
    </span>
  );
}

export function Tabs({ items, active }: { items: { id: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`rounded-md px-3 py-1.5 text-sm ${
            t.id === active ? "bg-accent font-semibold text-black" : "bg-panel-2 text-muted hover:text-text"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  );
}

export const pct = (n: number) => `${n.toFixed(2)}%`;

export function WinRate({ value }: { value: number }) {
  const color = value >= 51 ? "text-win" : value < 49 ? "text-lose" : "text-text";
  return <span className={color}>{pct(value)}</span>;
}
