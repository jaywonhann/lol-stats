import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { dict } from "@/lib/i18n";
import { getLang } from "@/lib/server";

const DOWNLOAD_URL = "https://github.com/jaywonhann/lol-stats/releases/latest/download/livelol-setup.exe";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLang()).nav.app };
}

export default async function DownloadPage() {
  const t = dict(await getLang()).app;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-xl border border-line bg-panel p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t.dlTitle}</h1>
        <p className="mt-3 text-muted">{t.dlLead}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href={DOWNLOAD_URL}
            className="rounded-lg bg-accent px-6 py-3 text-base font-bold text-white shadow transition hover:brightness-110"
          >
            ⬇ {t.dlButton}
          </a>
          <span className="text-xs text-muted">{t.dlSize}</span>
          <Link href="/app" className="text-sm text-accent hover:underline">
            {t.dlTry} →
          </Link>
        </div>
      </section>
      <Panel title={t.dlHow}>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {t.dlSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-4 rounded-md bg-panel-2 p-3 text-xs text-muted">{t.dlSafe}</p>
      </Panel>
    </div>
  );
}
