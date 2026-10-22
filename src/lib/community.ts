// 커뮤니티 글/댓글 저장소: 비공개 저장소의 GitHub 이슈 (label "community"). 이슈를 닫으면 사이트에서 숨겨집니다.
export const CATS = ["free", "build", "duo", "question"] as const;
export type Cat = (typeof CATS)[number];

const REPO = process.env.FEEDBACK_REPO?.trim() || "jaywonhann/lol-stats-feedback";
export const token = () => process.env.FEEDBACK_TOKEN?.trim() || undefined;

export type Post = { n: number; cat: Cat; title: string; nick: string; body: string; at: string; comments: number };
export type Comment = { id: number; nick: string; body: string; at: string };

const gh = (path: string, init?: RequestInit & { next?: { revalidate: number; tags: string[] } }) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "livelol-stats-community",
    },
    signal: AbortSignal.timeout(8000),
  });

const NICK = /<!--nick:(.*?)-->/;
const split = (raw: string | null) => {
  const s = raw ?? "";
  return { nick: s.match(NICK)?.[1] || "익명", body: s.replace(NICK, "").trim() };
};

type Issue = {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  comments: number;
  labels: { name: string }[];
  pull_request?: unknown;
};
const toPost = (i: Issue): Post => {
  const { nick, body } = split(i.body);
  const cat = (i.labels.map((l) => l.name.replace("c:", "")).find((c) => (CATS as readonly string[]).includes(c)) ?? "free") as Cat;
  return { n: i.number, cat, title: i.title, nick, body, at: i.created_at, comments: i.comments };
};

export async function listPosts(cat?: Cat): Promise<Post[] | null> {
  if (!token()) return null;
  const label = cat ? `community,c:${cat}` : "community";
  const res = await gh(`/issues?labels=${encodeURIComponent(label)}&state=open&per_page=40&sort=created&direction=desc`, {
    next: { revalidate: 30, tags: ["community"] },
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as Issue[]).filter((i) => !i.pull_request).map(toPost);
}

export async function getPost(n: number): Promise<{ post: Post; comments: Comment[] } | null> {
  if (!token()) return null;
  const [pr, cr] = await Promise.all([
    gh(`/issues/${n}`, { next: { revalidate: 30, tags: ["community"] } }).catch(() => null),
    gh(`/issues/${n}/comments?per_page=100`, { next: { revalidate: 30, tags: ["community"] } }).catch(() => null),
  ]);
  if (!pr?.ok) return null;
  const issue = (await pr.json()) as Issue & { state: string };
  if (issue.state !== "open" || !issue.labels.some((l) => l.name === "community")) return null;
  const raw = cr?.ok ? ((await cr.json()) as { id: number; body: string; created_at: string }[]) : [];
  return {
    post: toPost(issue),
    comments: raw.map((c) => ({ id: c.id, ...split(c.body), at: c.created_at })),
  };
}

export async function createPost(p: { cat: Cat; title: string; nick: string; body: string }) {
  const res = await gh(`/issues`, {
    method: "POST",
    body: JSON.stringify({ title: p.title, body: `${p.body}\n\n<!--nick:${p.nick}-->`, labels: ["community", `c:${p.cat}`] }),
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { number: number }).number;
}

export async function createComment(n: number, nick: string, body: string) {
  const res = await gh(`/issues/${n}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: `${body}\n\n<!--nick:${nick}-->` }),
  }).catch(() => null);
  return !!res?.ok;
}
