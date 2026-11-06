// Render 무료 서버(512MB, CPU 아주 작음)용 실행 파일.
// 페이지 요청이 한꺼번에 몰리면 렌더링이 겹쳐서 메모리가 넘치고 서버가 꺼져요.
// 그래서 페이지는 한 번에 MAX_CONCURRENT개씩만 만들고, 나머지는 줄 세워 차례로 처리합니다.
// 정적 파일(/_next/static, 이미지 등)은 가벼워서 줄을 서지 않아요.
import { createServer } from "node:http";
import next from "next";

const port = Number(process.env.PORT ?? 3000);
const MAX = Number(process.env.MAX_CONCURRENT ?? 2);
const MAX_QUEUE = Number(process.env.MAX_QUEUE ?? 100);
const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

// 한 번 만든 페이지는 잠깐 저장해 두고 같은 요청이 오면 바로 보내요 (데이터는 배포할 때만 바뀌어요).
// 언어·서버 쿠키와 Next가 페이지 이동 때 보내는 헤더까지 같아야 같은 요청으로 봐요.
const CACHE_MB = Number(process.env.PAGE_CACHE_MB ?? 56);
const CACHEABLE = /^\/(|tier|duo|aram|aram\/[^/]+|champions\/[^/]+|items|matchup|meta|trends|ranking|pros|tools|predict|faq|community|privacy)$/;
const pageCache = new Map(); // key -> { at, status, headers, body }
let cacheBytes = 0;
const ttl = (pathname) =>
  (pathname === "/" || pathname === "/pros" ? 5 : pathname.startsWith("/champions/") ? 120 : 30) * 60_000;
const cookieOf = (req, name) => (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1] ?? "";
function cacheKey(req) {
  if (req.method !== "GET") return null;
  const pathname = (req.url ?? "/").split("?")[0];
  if (!CACHEABLE.test(pathname)) return null;
  const h = req.headers;
  return [
    req.url,
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
  while (cacheBytes > CACHE_MB * 1_000_000 && pageCache.size) {
    const [k, v] = pageCache.entries().next().value;
    pageCache.delete(k);
    cacheBytes -= v.body.length;
  }
}
function fromCache(key, res) {
  const hit = key && pageCache.get(key);
  if (!hit) return false;
  if (Date.now() - hit.at > hit.ttl) {
    pageCache.delete(key);
    cacheBytes -= hit.body.length;
    return false;
  }
  res.writeHead(hit.status, { ...hit.headers, "x-page-cache": "hit" });
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

let active = 0;
const queue = [];
const light = (url = "") =>
  url.startsWith("/_next/static") || url.startsWith("/emblems/") || /\.(png|jpg|svg|ico|txt|webp|css|js|woff2?)$/.test(url.split("?")[0]);

function run(req, res) {
  const key = cacheKey(req);
  if (fromCache(key, res)) return void queue.shift()?.();
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
createServer((req, res) => {
  if (light(req.url)) return void handle(req, res);
  // 저장해 둔 페이지는 줄을 안 서고 바로 보내요
  if (fromCache(cacheKey(req), res)) return;
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
const WARM = ["/", "/tier", "/tier?lane=top", "/tier?lane=jungle", "/tier?lane=bottom", "/tier?lane=support", "/aram", "/duo", "/meta"];
async function warm() {
  if (process.env.PAGE_CACHE_MB === "0") return;
  for (const lang of ["ko", "en"])
    for (const p of WARM)
      for (const rsc of [false, true]) {
        try {
          await fetch(`http://127.0.0.1:${port}${p}`, {
            headers: { cookie: `lang=${lang}`, "accept-encoding": "gzip", ...(rsc ? { rsc: "1" } : {}) },
          }).then((r) => r.arrayBuffer());
        } catch {
          // 미리 만들기는 실패해도 괜찮아요
        }
      }
  idleWarm();
}

// 챔피언 페이지는 종류가 많아서, 방문자가 아무도 없을 때만 하나씩 미리 만들어 둬요 (100분마다 한 바퀴)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function idleWarm() {
  for (;;) {
    let ids = [];
    try {
      const dd = process.env.DDRAGON_BASE ?? "https://ddragon.leagueoflegends.com";
      const [v] = await fetch(`${dd}/api/versions.json`).then((r) => r.json());
      ids = Object.keys((await fetch(`${dd}/cdn/${v}/data/en_US/champion.json`).then((r) => r.json())).data);
    } catch {
      // 다음 바퀴에 다시
    }
    const started = Date.now();
    for (const id of ids)
      for (const [lang, rsc] of [["ko", true], ["en", true], ["en", false]]) {
        while (active > 0 || queue.length > 0) await sleep(1_000);
        try {
          await fetch(`http://127.0.0.1:${port}/champions/${id}`, {
            headers: { cookie: `lang=${lang}`, "accept-encoding": "gzip", ...(rsc ? { rsc: "1" } : {}) },
          }).then((r) => r.arrayBuffer());
        } catch {
          // 괜찮아요
        }
        await sleep(300);
      }
    await sleep(Math.max(60_000, 100 * 60_000 - (Date.now() - started)));
  }
}
