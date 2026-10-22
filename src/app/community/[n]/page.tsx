import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityForm from "@/components/CommunityForm";
import { Panel } from "@/components/ui";
import { getPost } from "@/lib/community";
import { ct } from "@/lib/community-text";
import { timeAgo } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const data = await getPost(n);
  if (!data) notFound();
  const lang = await getLang();
  const t = ct(lang);
  const { post, comments } = data;
  return (
    <div className="space-y-6">
      <Link href="/community" className="text-sm text-muted hover:text-text">{t.back}</Link>
      <Panel>
        <span className="rounded bg-panel-2 px-2 py-0.5 text-xs text-muted">{t.cats[post.cat]}</span>
        <h1 className="mt-2 text-xl font-bold">{post.title}</h1>
        <div className="mt-1 text-xs text-muted">
          {post.nick} · {timeAgo(post.at, lang, { minutes: true })}
        </div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
      </Panel>
      <Panel title={`${t.comments} ${comments.length}`}>
        {comments.length === 0 ? (
          <p className="mb-4 text-sm text-muted">{t.noComments}</p>
        ) : (
          <ul className="mb-4 divide-y divide-line">
            {comments.map((c) => (
              <li key={c.id} className="py-3">
                <div className="text-xs text-muted">
                  {c.nick} · {timeAgo(c.at, lang, { minutes: true })}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <CommunityForm kind="comment" n={n} labels={{ ...t.form, body: t.commentPh }} />
      </Panel>
    </div>
  );
}
