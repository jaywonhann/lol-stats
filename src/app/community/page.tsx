import type { Metadata } from "next";
import Link from "next/link";
import CommunityForm from "@/components/CommunityForm";
import { Panel } from "@/components/ui";
import { CATS, listPosts, type Cat } from "@/lib/community";
import { ct } from "@/lib/community-text";
import { timeAgo } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 · livelol.stats" };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const lang = await getLang();
  const t = ct(lang);
  const { c } = await searchParams;
  const cat = (CATS as readonly string[]).includes(c ?? "") ? (c as Cat) : undefined;
  const posts = await listPosts(cat);
  const tab = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-text"}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/community" className={tab(!cat)}>{t.all}</Link>
        {CATS.map((k) => (
          <Link key={k} href={`/community?c=${k}`} className={tab(cat === k)}>{t.cats[k]}</Link>
        ))}
      </div>
      <Panel title={t.write}>
        <CommunityForm
          kind="post"
          defaultCat={cat}
          cats={CATS.map((k) => ({ id: k, label: t.cats[k] }))}
          labels={{ ...t.form }}
        />
        <p className="mt-2 text-xs text-muted">{t.rule}</p>
      </Panel>
      <Panel>
        {posts === null ? (
          <p className="text-sm text-muted">{t.off}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {posts.map((p) => (
              <li key={p.n}>
                <Link href={`/community/${p.n}`} className="flex items-center gap-3 py-3 hover:bg-panel-2/50">
                  <span className="shrink-0 rounded bg-panel-2 px-2 py-0.5 text-xs text-muted">{t.cats[p.cat]}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.title}
                    {p.comments > 0 && <span className="ml-1 text-accent">[{p.comments}]</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {p.nick} · {timeAgo(p.at, lang, { minutes: true })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
