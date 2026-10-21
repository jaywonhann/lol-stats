// 유튜브에서 조회수 높은 롤 빌드 영상 고르기 (API 키 없이)
// 1) 시드 영상의 oEmbed로 채널 핸들을 알아내고
// 2) 채널 페이지에서 channelId를 찾은 뒤
// 3) 채널 RSS(최근 15개 영상, 조회수 포함)에서 빌드 관련 영상만 조회수 순으로 뽑는다.
// 결과는 6시간 캐시. 전부 실패하면 시드 영상을 조회수 없이 보여준다.
import type { Lang } from "./i18n";

const BASE = process.env.YOUTUBE_BASE ?? "https://www.youtube.com";
const REVALIDATE = 6 * 60 * 60;
const MAX_AGE_DAYS = 60;

export type Video = {
  id: string;
  title: string;
  channel: string;
  views: number | null;
  published: string | null;
};

// 웹 검색으로 찾은 롤 빌드/메타 영상들 (채널을 알아내는 출발점이자 대체 목록)
const SEEDS: Record<Lang, { id: string; title: string }[]> = {
  ko: [
    { id: "QD6wiP0uoPQ", title: "돌아온 탑캐리의 시대와 개사기 신규 아이템들. 파멸적인 롤 2026 시즌 총정리" },
    { id: "B5zf2NRAfOg", title: "다음 패치, 얘네들 뜹니다." },
    { id: "JcmuHogAXns", title: "이번 롤드컵은 혼돈 확정입니다. 밸런스 대격변 26.20 패치 미리보기!" },
    { id: "otlhkA4djrE", title: "진짜 실력자들만 살아남는 롤 26시즌 대격변 최종 변경점" },
    { id: "u-HIbEeNa1I", title: "2026 시즌 1 원딜의 모든 것 (feat. 프로관전러 P.S)" },
    { id: "TcQkSR3yvm8", title: "26.19 패치노트 완벽 정리" },
  ],
  en: [
    { id: "hIyuZg_xVj4", title: "Mathematically correct Riven one shots you with a single auto (NEW BROKEN BUILD)" },
    { id: "hXTwH3FLw4c", title: "Pentaburn Brand is the most broken build and it's not even close" },
    { id: "iMZ-Qumk8x8", title: "VOLIBEAR TOP NEW BUILD.. 1V5 EASIER THAN EVER (NEW META)" },
    { id: "BVjSAzwwnXQ", title: "RENEKTON, BUT I'M A WALKING MICROWAVE WHEN I PRESS R! (NEW BROKEN BUILD)" },
    { id: "JpBwNBiwBbs", title: "MAOKAI BUT I HAVE OVER 1000 AP AND ZERO COOLDOWNS!" },
    { id: "rKt7Sdsl1dQ", title: "THIS INFINITE HEALING ILLAOI IS THE MOST BROKEN BUILD EVER!" },
    { id: "mWS4rZGCTxY", title: "The Most Broken Build in League of Legends" },
  ],
};

const BUILD_WORDS: Record<Lang, RegExp> = {
  ko: /빌드|템트리|아이템|룬|사기|OP|1티어|메타|공략|국밥|꿀챔/i,
  en: /build|items?\b|runes?\b|guide|broken|\bop\b|meta|one ?shot/i,
};

async function get(url: string, revalidate = REVALIDATE): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: { "Accept-Language": "en-US,en;q=0.8" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function channelOf(videoId: string): Promise<string | null> {
  const o = await get(
    `${BASE}/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
  );
  if (!o) return null;
  let author: string | undefined;
  try {
    author = JSON.parse(o).author_url;
  } catch {
    return null;
  }
  if (!author) return null;
  const direct = author.match(/\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const page = await get(author.replace("https://www.youtube.com", BASE));
  return (
    page?.match(/<link rel="canonical" href="[^"]*\/channel\/(UC[\w-]{22})"/)?.[1] ??
    page?.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/)?.[1] ??
    null
  );
}

const unescape = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function parseFeed(xml: string): Video[] {
  const channel = unescape(xml.match(/<author>\s*<name>([^<]*)<\/name>/)?.[1] ?? "");
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, e]) => {
    const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = e.match(/<title>([^<]*)<\/title>/)?.[1];
    if (!id || !title) return [];
    const views = e.match(/<media:statistics views="(\d+)"/)?.[1];
    return [
      {
        id,
        title: unescape(title),
        channel,
        views: views ? Number(views) : null,
        published: e.match(/<published>([^<]+)<\/published>/)?.[1] ?? null,
      },
    ];
  });
}

async function channelIds(lang: Lang) {
  return [
    ...new Set(
      (await Promise.all(SEEDS[lang].map((s) => channelOf(s.id)))).filter(
        (x): x is string => !!x,
      ),
    ),
  ];
}

async function pool(lang: Lang): Promise<Video[]> {
  const ids = await channelIds(lang);
  const feeds = await Promise.all(
    ids.map((id) => get(`${BASE}/feeds/videos.xml?channel_id=${id}`)),
  );
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400_000;
  return feeds
    .flatMap((x) => (x ? parseFeed(x) : []))
    .filter(
      (v) =>
        v.views !== null &&
        BUILD_WORDS[lang].test(v.title) &&
        !/#shorts/i.test(v.title) &&
        (!v.published || Date.parse(v.published) >= cutoff),
    )
    .sort((a, b) => b.views! - a.views!)
    .filter((v, i, all) => all.findIndex((x) => x.id === v.id) === i);
}

/** 선택한 언어의 조회수 상위 빌드 영상. 모자라면 같은 언어의 시드 영상으로 채운다 (다른 언어 영상은 섞지 않음). */
export async function hotBuildVideos(lang: Lang, n = 4): Promise<Video[]> {
  const out = (await pool(lang)).slice(0, n);
  for (const s of SEEDS[lang]) {
    if (out.length >= n) break;
    if (!out.some((v) => v.id === s.id))
      out.push({ ...s, channel: "", views: null, published: null });
  }
  return out;
}

export type LiveStream = { id: string; title: string; channel: string };

/** 지금 생방송 중인 롤 채널 (채널의 /live 페이지가 생방송 영상으로 이어지는지 확인, 5분 캐시) */
export async function liveStreams(lang: Lang): Promise<LiveStream[]> {
  const ids = await channelIds(lang);
  const pages = await Promise.all(ids.map((id) => get(`${BASE}/channel/${id}/live`, 300)));
  return pages.flatMap((html) => {
    if (!html || !/"isLiveNow":true/.test(html)) return [];
    const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
    if (!id) return [];
    const title = unescape(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "");
    const channel = unescape(html.match(/"ownerChannelName":"([^"]*)"/)?.[1] ?? "");
    return [{ id, title, channel }];
  });
}

/** 롤 채널들의 최근 영상 (최근 14일, 쇼츠 제외, 조회수 높은 순) */
export async function recentVideos(lang: Lang, n = 6): Promise<Video[]> {
  const ids = await channelIds(lang);
  const feeds = await Promise.all(ids.map((id) => get(`${BASE}/feeds/videos.xml?channel_id=${id}`)));
  const cutoff = Date.now() - 14 * 86400_000;
  return feeds
    .flatMap((x) => (x ? parseFeed(x) : []))
    .filter((v) => !/#shorts/i.test(v.title) && v.published && Date.parse(v.published) >= cutoff)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .filter((v, i, all) => all.findIndex((x) => x.id === v.id) === i)
    .slice(0, n);
}
