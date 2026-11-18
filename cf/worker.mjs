// Cloudflare Worker: scripts/mirror.mjs가 만든 정적 사본을 원래 주소 그대로 보여 줘요.
// 2026-11-18 Render 무료 전송량(월 5GB)이 다 차서 사이트가 멈춘 뒤 만든 길이에요. 정적 파일 전송은 무료·무제한이에요.
// 전적 검색·실시간처럼 서버가 필요한 기능은 ORIGIN(Render 주소)이 설정돼 있을 때만 그쪽으로 넘기고, 없으면 "잠시 쉬어요" 화면을 보여 줘요.
import { pageKey } from "./key.mjs";

const BOT_UA = /bot|crawl|spider|slurp|yeti|preview|scrap|facebookexternalhit|curl|wget|python|headless|lighthouse|monitor|uptime|axios|node-fetch|go-http|okhttp|java\/|^$/i;
const TRAIN_UA = /meta-externalagent|gptbot|ccbot|bytespider|claudebot|anthropic-ai|amazonbot|diffbot|omgili|imagesiftbot|petalbot|semrushbot|ahrefsbot|mj12bot|dotbot|dataforseo|barkrowler|blexbot/i;
const SHARE_UA = [["kakao", /kakaotalk/i], ["facebook", /facebookexternalhit/i], ["twitter", /twitterbot/i], ["discord", /discordbot/i], ["slack", /slackbot/i], ["telegram", /telegrambot/i], ["whatsapp", /whatsapp/i], ["line", /line-poker|linebot/i]];
const CRAWL_UA = [["google", /googlebot|google-inspectiontool|googleother/i], ["naver", /yeti|naverbot/i], ["bing", /bingbot|bingpreview/i], ["daum", /daum/i], ["yandex", /yandex/i], ["ai", /gptbot|chatgpt|claudebot|perplexity|bytespider|ccbot|amazonbot|meta-externalagent/i]];
const REF_NAMES = [["ai", /chatgpt\.com$|openai\.com$|perplexity\.ai$|claude\.ai$|gemini\.google\.com$|copilot\.microsoft\.com$|(^|\.)you\.com$|phind\.com$/], ["google", /(^|\.)google\./], ["naver", /(^|\.)naver\.com$/], ["bing", /(^|\.)bing\.com$/], ["daum", /(^|\.)daum\.net$/], ["duckduckgo", /duckduckgo/], ["threads", /threads\.(net|com)$/], ["instagram", /instagram\.com$/], ["facebook", /facebook\.com$/], ["x", /^(t\.co|x\.com|twitter\.com)$/], ["reddit", /reddit\.com$/], ["youtube", /youtube\.com$|youtu\.be$/], ["discord", /discord/], ["kakao", /kakao/], ["tistory", /tistory\.com$/], ["inven", /inven\.co\.kr$/], ["dcinside", /dcinside\.com$/], ["fmkorea", /fmkorea\.com$/], ["tiktok", /tiktok\.com$/]];
const LANE_WORD = { top: "top", jungle: "jungle", jg: "jungle", mid: "mid", middle: "mid", bottom: "bottom", bot: "bottom", adc: "bottom", support: "support", sup: "support", 탑: "top", 정글: "jungle", 미드: "mid", 원딜: "bottom", 바텀: "bottom", 서폿: "support", 서포터: "support" };
const REGION = { kr: "kr", na: "na1", na1: "na1", euw: "euw1", euw1: "euw1" };
// 서버가 있어야 되는 주소 (사본으로는 못 보여 줘요)
const DYNAMIC = /^\/(api\/|pros$|community|multi$|ranking$|visits$|predict$)/;

const bump = (o, k, cap = 200) => {
  if (k in o) o[k]++;
  else if (Object.keys(o).length < cap) o[k] = 1;
};
const today = () => new Date().toISOString().slice(0, 10);
const newDay = () => ({ salt: crypto.randomUUID(), seen: [], uv: 0, land: 0, nav: 0, ref: {}, top: {}, bots: {}, shares: {}, entry: {}, flow: {}, ev: {}, out: {} });

// ── 방문자 세기 (server.mjs와 같은 규칙. 날짜별 기록을 KV에 둬요) ─────────────
// KV 무료는 하루 1,000번까지 쓸 수 있어서, 사람 신호(/__hit)와 짧은 주소만 바로 쓰고 로봇·미리보기는 세지 않아요.
async function change(env, fn) {
  if (!env.VISITS) return;
  const key = `day:${today()}`;
  const d = (await env.VISITS.get(key, "json")) ?? newDay();
  if ((await fn(d)) === false) return;
  await env.VISITS.put(key, JSON.stringify(d), { expirationTtl: 86400 * 10 });
}
async function hit(req, url, env) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return;
  const q = url.searchParams;
  const e = q.get("e");
  if (e) {
    if (/^[a-z0-9-]{1,30}$/.test(e)) await change(env, (d) => bump(d.ev, e, 40));
    return;
  }
  const page = (q.get("p") ?? "/").split("?")[0].slice(0, 80);
  if (!page.startsWith("/")) return;
  const ip = req.headers.get("cf-connecting-ip") ?? "";
  await change(env, async (d) => {
    // IP는 저장하지 않아요: 그날만 쓰는 무작위 값과 섞은 지문으로 "서로 다른 방문자 수"만 세요
    const raw = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${d.salt}|${ip}|${ua}`)));
    const id = btoa(String.fromCharCode(...raw)).slice(0, 12);
    if (!d.seen.includes(id) && d.seen.length < 20000) {
      d.seen.push(id);
      d.uv++;
    }
    const r = (q.get("r") ?? "").toLowerCase().replace(/^www\./, "").slice(0, 60);
    // 사본에서는 페이지를 옮길 때마다 새로 열려서, 우리 사이트에서 온 접속을 "사이트 안 이동"으로 세요
    if (q.get("n") === "1" || r === url.hostname) {
      d.nav++;
      const f = (q.get("f") ?? "").split("?")[0].slice(0, 80);
      if (f.startsWith("/")) bump(d.flow, `${f} > ${page}`, 200);
    } else {
      d.land++;
      const from = r ? (REF_NAMES.find(([, re]) => re.test(r))?.[0] ?? r) : "direct";
      bump(d.ref, from, 60);
      bump(d.entry, `${from} ${page}`, 200);
    }
    bump(d.top, page);
  });
}
async function stats(env) {
  const days = {};
  if (env.VISITS)
    for (let i = 0; i < 3; i++) {
      const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const d = await env.VISITS.get(`day:${day}`, "json");
      if (d) days[day] = { uv: d.uv, land: d.land, nav: d.nav, ref: d.ref, top: d.top, bots: d.bots, shares: d.shares, entry: d.entry, flow: d.flow, ev: d.ev, out: d.out };
    }
  return Response.json({ v: 3, boot: "cloudflare", now: new Date().toISOString(), days }, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

let slugs;
const slugOf = (v) => v.toLowerCase().replace(/[\s'.&_-]/g, "");
async function shortcut(req, url, env, ctx) {
  const pathname = url.pathname;
  const m = /^\/s\/()([^/]+)\/?$/.exec(pathname) ?? /^(?:\/lol)?\/summoners?\/([a-z0-9]+)\/([^/]+)\/?$/i.exec(pathname) ?? /^\/lol\/profile\/([a-z0-9]+)\/([^/]+)(?:\/[a-z-]*)?\/?$/i.exec(pathname);
  if (m) {
    let who;
    try {
      who = decodeURIComponent(m[2]).replace(/\+/g, " ").trim().slice(0, 60);
    } catch {
      return null;
    }
    if (!who) return null;
    const i = who.lastIndexOf("-");
    const id = who.includes("#") || i <= 0 || i === who.length - 1 ? who : `${who.slice(0, i)}#${who.slice(i + 1)}`;
    const server = REGION[m[1].toLowerCase()] ?? url.searchParams.get("s");
    return `/summoner?id=${encodeURIComponent(id)}${server && REGION[server] ? `&s=${REGION[server]}` : ""}`;
  }
  if (pathname.length > 120 || pathname.includes(".")) return null;
  let parts;
  try {
    parts = decodeURIComponent(pathname).split("/").filter(Boolean);
  } catch {
    return null;
  }
  if (parts.length < 1 || parts.length > 2) return null;
  slugs ??= await (await env.ASSETS.fetch(new URL("/_p/slugs.json", url))).json().catch(() => ({}));
  const find = (v) => slugs[slugOf(v)];
  let to;
  let kind;
  const vs = /^(.+?)[-_ ](?:vs|대)[-_ ](.+)$/i.exec(parts[0]);
  if (vs) {
    const a = find(vs[1]);
    const b = find(vs[2]);
    if (!a || !b || a === b) return null;
    const lane = parts[1] ? LANE_WORD[parts[1].toLowerCase()] : undefined;
    if (parts[1] && !lane) return null;
    to = `/matchup?a=${a}&b=${b}${lane ? `&lane=${lane}` : ""}`;
    kind = "short-vs";
  } else if (parts.length === 2 && /^(counters?|카운터)$/i.test(parts[0])) {
    const c = find(parts[1]);
    if (!c) return null;
    to = `/champions/${c}/counters`;
    kind = "short-counter";
  } else if (parts.length === 1) {
    const c = find(parts[0]);
    if (!c) return null;
    to = `/champions/${c}`;
    kind = "short-champ";
  } else return null;
  if (!BOT_UA.test(req.headers.get("user-agent") ?? "")) ctx.waitUntil(change(env, (d) => bump(d.ev, kind, 40)));
  return to;
}

const paused = (ko, what) => `<!doctype html><html lang="${ko ? "ko" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>livelol.stats</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f1a;color:#e5e7eb;font:16px/1.6 system-ui,sans-serif}main{max-width:26rem;padding:24px;text-align:center}h1{font-size:1.25rem}a{display:inline-block;margin:6px;padding:10px 16px;border-radius:10px;background:#1f2937;color:#fff;text-decoration:none}p{color:#9ca3af}</style></head><body><main>
<h1>${ko ? `${what} 기능은 잠시 쉬고 있어요` : `${what} is taking a short break`}</h1>
<p>${ko ? "서버를 옮기는 중이라 12월 1일에 다시 열려요. 티어표·챔피언·상성 통계는 지금도 볼 수 있어요." : "We are moving servers, so it returns on December 1. Tier list, champion and matchup stats work now."}</p>
<a href="/tier">${ko ? "티어표" : "Tier list"}</a><a href="/matchup">${ko ? "상성" : "Matchups"}</a><a href="/daily">${ko ? "오늘의 퀴즈" : "Daily quiz"}</a><a href="/">${ko ? "첫 화면" : "Home"}</a>
</main></body></html>`;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    const ua = req.headers.get("user-agent") ?? "";
    if (p === "/__hit") {
      ctx.waitUntil(hit(req, url, env).catch(() => {}));
      return new Response(null, { status: 204, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
    }
    if (p === "/__stats") return stats(env);
    // 글을 긁어 가기만 하는 로봇은 아무것도 주지 않아요
    if (TRAIN_UA.test(ua)) return new Response(null, { status: 429, headers: { "retry-after": "86400" } });
    if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
    if (p.startsWith("/_p/")) return new Response(null, { status: 404 });
    const asset = (path) => env.ASSETS.fetch(new Request(new URL(path, url), { method: "GET" }));
    // public 폴더 파일·사이트맵 등 (확장자가 있는 주소)
    if (/\.[a-z0-9]{2,5}$/i.test(p)) return env.ASSETS.fetch(req);

    const cookieKo = /(?:^|;\s*)lang=ko/.test(req.headers.get("cookie") ?? "");
    const lp = url.searchParams.get("lang");
    const ko = lp === "ko" || (lp !== "en" && cookieKo);
    const html = (res, status = 200, extra = {}) => {
      const h = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=600", vary: "cookie", ...extra });
      // ?lang= 으로 들어온 사람은 다음 페이지에서도 같은 언어로 보여요
      if (lp === "ko" || lp === "en") h.append("set-cookie", `lang=${lp}; path=/; max-age=31536000; samesite=lax`);
      return new Response(req.method === "HEAD" ? null : res.body, { status, headers: h });
    };
    const pause = (what) => new Response(paused(ko, what), { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "86400", "cache-control": "no-store" } });

    // 공유 미리보기 그림
    if (p.endsWith("/opengraph-image") || p === "/opengraph-image") {
      let r = await asset(`/_p${p}.png`);
      if (r.status !== 200) r = await asset("/_p/opengraph-image.png");
      return r.status === 200 ? new Response(r.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } }) : new Response(null, { status: 404 });
    }
    const to = await shortcut(req, url, env, ctx);
    if (to) return new Response(null, { status: 302, headers: { location: to, "cache-control": "public, max-age=3600", "x-robots-tag": "noindex" } });
    if (p.startsWith("/api/")) return Response.json({ error: "paused" }, { status: 503, headers: { "cache-control": "no-store" } });
    if (p === "/summoner" && url.searchParams.get("id")) return pause(ko ? "전적 검색" : "Summoner search");
    if (DYNAMIC.test(p)) return pause(ko ? "이" : "This feature");

    const params = new URLSearchParams(url.searchParams);
    params.delete("lang");
    if (ko) params.set("lang", "ko");
    const tries = [pageKey(p, params)];
    // 라인을 뺀 주소, 그다음 물음표 뒤를 다 뺀 주소 순으로 찾아요
    if (params.get("lane")) {
      const q = new URLSearchParams(params);
      q.delete("lane");
      tries.push(pageKey(p, q));
    }
    const hasPick = params.get("a") || params.get("b");
    if (!hasPick) tries.push(pageKey(p, new URLSearchParams(ko ? "lang=ko" : "")));
    for (const k of [...new Set(tries)]) {
      const r = await asset(k);
      if (r.status === 200) return html(r);
    }
    if (p === "/matchup" && hasPick) return pause(ko ? "이 조합의 상성" : "This matchup");
    const nf = await asset(`/_p/404${ko ? ".ko" : ""}.html`);
    return html(nf, 404, { "cache-control": "no-store" });
  },
};
