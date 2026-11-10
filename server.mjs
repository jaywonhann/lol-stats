// Render 무료 서버(512MB, CPU 아주 작음)용 실행 파일.
// 페이지 요청이 한꺼번에 몰리면 렌더링이 겹쳐서 메모리가 넘치고 서버가 꺼져요.
// 그래서 페이지는 한 번에 MAX_CONCURRENT개씩만 만들고, 나머지는 줄 세워 차례로 처리합니다.
// 정적 파일(/_next/static, 이미지 등)은 가벼워서 줄을 서지 않아요.
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import next from "next";

const port = Number(process.env.PORT ?? 3000);
const MAX = Number(process.env.MAX_CONCURRENT ?? 2);
const MAX_QUEUE = Number(process.env.MAX_QUEUE ?? 100);
const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

// 한 번 만든 페이지는 잠깐 저장해 두고 같은 요청이 오면 바로 보내요 (데이터는 배포할 때만 바뀌어요).
// 언어·서버 쿠키와 Next가 페이지 이동 때 보내는 헤더까지 같아야 같은 요청으로 봐요.
// 512MB 서버라 저장 공간은 36MB까지 (챔피언 미리 만들기가 다 차면 56MB에선 메모리가 넘쳐 서버가 다시 켜졌어요)
const CACHE_MB = Number(process.env.PAGE_CACHE_MB ?? 36);
const CACHEABLE = /^\/(|tier|duo|aram|aram\/[^/]+|champions|champions\/[^/]+|champions\/[^/]+\/counters|items|matchup|bans|meta|trends|ranking|pros|tools|predict|multi|faq|community|privacy)$/;
// 메뉴 페이지(아래 WARM 목록)는 챔피언 페이지가 저장 공간을 채워도 지우지 않아요. 메뉴를 누르면 늘 바로 오게.
// (KR 서버 기준만 고정해서 메모리를 아껴요)
const pinned = (key) => {
  const [url, , server] = key.split("\u0001");
  return server === "kr" && WARM_SET.has(url);
};
const pageCache = new Map(); // key -> { at, status, headers, body }
let cacheBytes = 0;
const ttl = (pathname) =>
  (pathname === "/" || pathname === "/pros" ? 5 : pathname.startsWith("/champions/") ? 120 : 30) * 60_000;
const cookieOf = (req, name) => (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1] ?? "";
function cacheKey(req) {
  if (req.method !== "GET") return null;
  const pathname = (req.url ?? "/").split("?")[0];
  if (!CACHEABLE.test(pathname)) return null;
  // 멀티서치 검색 결과(소환사 이름이 들어간 주소)는 저장하지 않아요
  if (pathname === "/multi" && /[?&]q=./.test(req.url ?? "")) return null;
  const h = req.headers;
  return [
    // _rsc 값은 보고 있던 페이지에 따라 달라지는 표시일 뿐이라 열쇠에서 빼요
    (req.url ?? "/").replace(/([?&])_rsc=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    // 사이트와 같은 규칙으로 정리 (쿠키가 없으면 영어·KR)
    cookieOf(req, "lang") === "ko" ? "ko" : "en",
    ["kr", "na1", "euw1"].includes(cookieOf(req, "server")) ? cookieOf(req, "server") : "kr",
    /gzip/.test(h["accept-encoding"] ?? "") ? "gz" : "",
    h["rsc"] ?? "",
    h["next-router-prefetch"] ?? "",
    h["next-router-segment-prefetch"] ?? "",
    // 레이아웃이 맨 위 하나뿐이라, 페이지 이동 응답은 어느 페이지에서 왔든 같아요.
    // 그래서 지금 보고 있는 페이지 정보(next-router-state-tree)는 열쇠에서 뺍니다.
  ].join("\u0001");
}
function remember(key, pathname, res, chunks) {
  const headers = res.getHeaders();
  if (res.statusCode !== 200 || headers["set-cookie"]) return;
  const body = Buffer.concat(chunks);
  if (body.length > 3_000_000) return;
  delete headers["transfer-encoding"];
  delete headers["connection"];
  headers["content-length"] = String(body.length);
  const old = pageCache.get(key);
  if (old) cacheBytes -= old.body.length;
  pageCache.delete(key);
  pageCache.set(key, { at: Date.now(), ttl: ttl(pathname), status: res.statusCode, headers, body });
  cacheBytes += body.length;
  // 가장 오래 안 쓴 것부터 지우되, 메뉴 페이지는 건너뛰어요
  for (const [k, v] of pageCache) {
    if (cacheBytes <= CACHE_MB * 1_000_000) break;
    if (pinned(k)) continue;
    pageCache.delete(k);
    cacheBytes -= v.body.length;
  }
}
// 시간이 지난 페이지도 12시간까지는 일단 바로 보내고, 뒤에서 새로 만들어 바꿔 넣어요 (첫 방문자가 5~8초 기다리지 않게)
const STALE_MAX = 12 * 60 * 60_000;
const refreshing = new Set();
function refresh(key, req) {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  const headers = { ...req.headers, "x-refresh": "1" };
  delete headers.host;
  delete headers.connection;
  fetch(`http://127.0.0.1:${port}${req.url}`, { headers })
    .then((r) => r.arrayBuffer())
    .catch(() => {})
    .finally(() => refreshing.delete(key));
}
function fromCache(key, res, req) {
  if (!key || req?.headers["x-refresh"]) return false;
  const hit = pageCache.get(key);
  if (!hit) return false;
  const age = Date.now() - hit.at;
  if (age > STALE_MAX) {
    pageCache.delete(key);
    cacheBytes -= hit.body.length;
    return false;
  }
  const stale = age > hit.ttl;
  if (stale && req) refresh(key, req);
  // 방금 쓴 페이지는 맨 뒤로 (자주 보는 페이지가 먼저 지워지지 않게)
  pageCache.delete(key);
  pageCache.set(key, hit);
  res.writeHead(hit.status, { ...hit.headers, "x-page-cache": stale ? "stale" : "hit" });
  res.end(hit.body);
  return true;
}
function record(key, req, res) {
  const chunks = [];
  const write = res.write.bind(res);
  const end = res.end.bind(res);
  res.write = (chunk, ...rest) => {
    if (chunk) chunks.push(Buffer.from(chunk, typeof rest[0] === "string" ? rest[0] : undefined));
    return write(chunk, ...rest);
  };
  res.end = (chunk, ...rest) => {
    if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk, typeof rest[0] === "string" ? rest[0] : undefined));
    return end(chunk, ...rest);
  };
  res.on("finish", () => remember(key, (req.url ?? "/").split("?")[0], res, chunks));
}

// 사이트 파일(/_next/static, public)은 서버가 켜질 때 메모리에 올려 두고 Next를 거치지 않고 바로 보내요.
// JS·CSS는 빌드 때 미리 압축한 것(.br/.gz, scripts/precompress.mjs)을 보내서 요청마다 압축하지 않아요.
const TYPES = { js: "application/javascript; charset=utf-8", css: "text/css; charset=utf-8", png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", woff2: "font/woff2", woff: "font/woff", json: "application/json", txt: "text/plain; charset=utf-8", webmanifest: "application/manifest+json" };
const files = new Map(); // url -> { type, raw, br, gz, immutable }
function load(dir, prefix, immutable) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) load(f, `${prefix}/${e.name}`, immutable);
    else if (!/\.(br|gz|map)$/.test(e.name)) {
      const ext = e.name.split(".").pop();
      if (!TYPES[ext]) continue;
      const read = (x) => (fs.existsSync(x) ? fs.readFileSync(x) : null);
      files.set(encodeURI(`${prefix}/${e.name}`).replace(/\[/g, "%5B").replace(/\]/g, "%5D"), { type: TYPES[ext], raw: fs.readFileSync(f), br: read(`${f}.br`), gz: read(`${f}.gz`), immutable });
    }
  }
}
load(path.join(process.cwd(), ".next", "static"), "/_next/static", true);
load(path.join(process.cwd(), "public"), "", false);
function sendFile(req, res) {
  const url = (req.url ?? "").split("?")[0];
  const f = files.get(url) ?? files.get(encodeURI(decodeURI(url)));
  if (!f || (req.method !== "GET" && req.method !== "HEAD")) return false;
  const ae = req.headers["accept-encoding"] ?? "";
  const [body, enc] = f.br && /\bbr\b/.test(ae) ? [f.br, "br"] : f.gz && /gzip/.test(ae) ? [f.gz, "gzip"] : [f.raw, null];
  res.writeHead(200, {
    "content-type": f.type,
    "content-length": body.length,
    "cache-control": f.immutable ? "public, max-age=31536000, immutable" : "public, max-age=86400",
    vary: "Accept-Encoding",
    ...(enc ? { "content-encoding": enc } : {}),
  });
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

let active = 0;
const queue = [];
const light = (url = "") =>
  url.startsWith("/_next/static") || url.startsWith("/emblems/") || /\.(png|jpg|svg|ico|txt|webp|css|js|woff2?)$/.test(url.split("?")[0]);

function run(req, res) {
  const key = cacheKey(req);
  if (fromCache(key, res, req)) return void queue.shift()?.();
  if (key) record(key, req, res);
  active++;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    active--;
    const nextJob = queue.shift();
    if (nextJob) nextJob();
  };
  res.on("finish", finish);
  res.on("close", finish);
  Promise.resolve(handle(req, res)).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
}

await app.prepare();
let lastVisit = 0; // 방문자 페이지 요청이 마지막으로 온 시각 (미리 만들기는 그 뒤 잠깐 쉬어요)
createServer((req, res) => {
  // ?lang=ko|en 주소(검색엔진이 언어별로 따로 담는 주소)는 쿠키보다 먼저 써요: 쿠키의 lang 값을 바꿔 넘깁니다
  const lp = /[?&]lang=(ko|en)(?:&|$)/.exec(req.url ?? "")?.[1];
  if (lp) {
    const rest = (req.headers.cookie ?? "").split(/;\s*/).filter((c) => c && !c.startsWith("lang="));
    req.headers.cookie = [...rest, `lang=${lp}`].join("; ");
    req.headers["x-lang-url"] = lp;
  }
  req.headers["x-pathname"] = (req.url ?? "/").split("?")[0];
  if (sendFile(req, res)) return;
  if (light(req.url)) return void handle(req, res);
  // 그림·파일·robots.txt(서버 깨우기)는 빼고 페이지 요청만 방문으로 쳐요
  if (req.socket.remoteAddress !== "127.0.0.1" && req.socket.remoteAddress !== "::ffff:127.0.0.1") lastVisit = Date.now();
  // 저장해 둔 페이지는 줄을 안 서고 바로 보내요
  if (fromCache(cacheKey(req), res, req)) return;
  if (active < MAX) return run(req, res);
  if (queue.length >= MAX_QUEUE) {
    res.statusCode = 503;
    res.setHeader("Retry-After", "5");
    return void res.end("busy, try again in a few seconds");
  }
  // 기다리다 접속을 끊은 요청은 건너뛰어요
  queue.push(() => (req.destroyed || res.destroyed ? (queue.shift()?.(), undefined) : run(req, res)));
}).listen(port, "0.0.0.0", () => {
  console.log(`> Ready on port ${port} (pages ${MAX} at a time)`);
  setTimeout(warm, 5_000);
});

// 서버가 켜지면 자주 가는 페이지를 미리 한 번씩 만들어 둬요 (한 번에 하나씩, 방문자 요청과 같이 줄 서요)
// 위쪽·아래쪽 메뉴에 있는 페이지는 전부 (누르면 바로 뜨게)
const WARM = ["/", "/tier", "/champions", "/bans", "/meta", "/aram", "/duo", "/ranking", "/items", "/trends", "/pros", "/multi", "/tools", "/predict", "/matchup", ...["top", "jungle", "mid", "bottom", "support"].map((l) => `/tier?lane=${l}&rank=all`)];
const WARM_SET = new Set(WARM);
async function warm(again = false) {
  if (process.env.PAGE_CACHE_MB === "0") return;
  for (const lang of ["ko", "en"])
    for (const p of WARM)
      for (const rsc of [false, true]) {
        // 다시 돌 때는 방문자가 없을 때만 (오래된 페이지는 이 요청이 뒤에서 새로 만들게 해요)
        if (again) while (active > 0 || queue.length > 0 || Date.now() - lastVisit < 8_000) await sleep(1_000);
        try {
          await fetch(`http://127.0.0.1:${port}${p}`, {
            headers: { cookie: `lang=${lang}`, "accept-encoding": "gzip", ...(rsc ? { rsc: "1" } : {}) },
          }).then((r) => r.arrayBuffer());
        } catch {
          // 미리 만들기는 실패해도 괜찮아요
        }
      }
  if (again) return;
  // 메뉴 페이지는 20분마다 한 번씩 확인해서, 오래됐으면 새로 만들어 둬요 (12시간 지나 지워지지 않게)
  setInterval(() => warm(true), 20 * 60_000);
  idleWarm();
}

// 챔피언 페이지는 종류가 많아서, 서버가 쉬는 틈마다 하나씩 미리 만들어 둬요.
// 배포하면 저장해 둔 페이지가 다 사라지니까, 많이 하는 챔피언부터 (한국어 페이지 이동 → 한국어 첫 방문 → 영어) 순서로 채워요.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 우리 수집 데이터(KR 에메랄드+, 최신 패치)에서 판수가 많은 챔피언 순서
function popularOrder(byKey) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/derived/real-kr-all.json"), "utf8"));
    const games = new Map();
    for (const [k, v] of Object.entries(d[d.length - 1]?.champs ?? {})) {
      const id = byKey[k.split(":")[0]];
      if (id) games.set(id, (games.get(id) ?? 0) + (v.games ?? 0));
    }
    return Object.values(byKey).sort((a, b) => (games.get(b) ?? 0) - (games.get(a) ?? 0));
  } catch {
    return Object.values(byKey);
  }
}
async function idleWarm() {
  for (;;) {
    let ids = [];
    try {
      const dd = process.env.DDRAGON_BASE ?? "https://ddragon.leagueoflegends.com";
      const [v] = await fetch(`${dd}/api/versions.json`).then((r) => r.json());
      const data = (await fetch(`${dd}/cdn/${v}/data/en_US/champion.json`).then((r) => r.json())).data;
      ids = popularOrder(Object.fromEntries(Object.values(data).map((c) => [c.key, c.id])));
    } catch {
      // 다음 바퀴에 다시
    }
    const started = Date.now();
    // 영어 첫 방문(HTML)은 드물어서 미리 만들지 않아요 (메모리 아끼기)
    for (const [lang, rsc] of [["ko", true], ["ko", false], ["en", true]])
      for (const id of ids) {
        // 방문자가 기다리지 않게: 만들고 있는 페이지가 없고, 마지막 방문 뒤 8초가 지났을 때만
        while (active > 0 || queue.length > 0 || Date.now() - lastVisit < 8_000) await sleep(1_000);
        try {
          await fetch(`http://127.0.0.1:${port}/champions/${id}`, {
            headers: { cookie: `lang=${lang}`, "accept-encoding": "gzip", ...(rsc ? { rsc: "1" } : {}) },
          }).then((r) => r.arrayBuffer());
        } catch {
          // 괜찮아요
        }
        await sleep(200);
      }
    await sleep(Math.max(60_000, 100 * 60_000 - (Date.now() - started)));
  }
}
