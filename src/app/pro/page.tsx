import type { Metadata } from "next";
import { Panel } from "@/components/ui";
import ProUnlock from "@/components/ProUnlock";
import { checkoutUrl, isPro, PRO_PRICE } from "@/lib/pro";
import { proText } from "@/lib/pro-text";
import { getLang, getServer } from "@/lib/server";
import { parseServer } from "@/lib/lanes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = proText(await getLang());
  return { title: `${p.title} · PRO`, description: p.tagline };
}

type Props = { searchParams: Promise<{ id?: string; s?: string }> };

export default async function ProPage({ searchParams }: Props) {
  const [sp, lang, cookieServer, pro] = await Promise.all([searchParams, getLang(), getServer(), isPro()]);
  const p = proText(lang);
  const server = sp.s ? parseServer(sp.s) : cookieServer;
  const id = typeof sp.id === "string" ? sp.id.slice(0, 60) : "";
  const buy = checkoutUrl();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-3 pt-2">
        <span className="inline-block rounded bg-accent px-2 py-0.5 text-xs font-black text-bg">{p.badge}</span>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">{p.title}</h1>
        <p className="text-base text-muted">{p.tagline}</p>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {p.features.map(([h, b]) => (
          <li key={h} className="rounded-lg bg-panel p-4">
            <p className="font-bold">{h}</p>
            <p className="mt-1 text-sm text-muted">{b}</p>
          </li>
        ))}
      </ul>

      <Panel>
        <p className="text-2xl font-black">
          {PRO_PRICE} <span className="text-sm font-normal text-muted">{p.terms}</span>
        </p>
        {!pro && (
          <div className="mt-3">
            {buy ? (
              <a href={buy} className="inline-block rounded-lg bg-accent px-5 py-2.5 font-bold text-bg hover:opacity-90">
                {p.buy(PRO_PRICE)}
              </a>
            ) : (
              <span className="inline-block cursor-not-allowed rounded-lg bg-panel-2 px-5 py-2.5 font-bold text-muted" aria-disabled>
                {p.soon}
              </span>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">{p.fine}</p>
        <div className="mt-5 border-t border-line pt-4">
          <ProUnlock lang={lang} active={pro} />
        </div>
      </Panel>

      <Panel title={p.openLabel}>
        <form action="/pro/report" className="flex flex-wrap gap-2">
          <input type="hidden" name="s" value={server} />
          <input
            name="id"
            defaultValue={id}
            placeholder={p.openPh}
            aria-label={p.openPh}
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10">
            {p.open}
          </button>
        </form>
      </Panel>
    </div>
  );
}
