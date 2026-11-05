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

let active = 0;
const queue = [];
const light = (url = "") =>
  url.startsWith("/_next/static") || url.startsWith("/emblems/") || /\.(png|jpg|svg|ico|txt|webp|css|js|woff2?)$/.test(url.split("?")[0]);

function run(req, res) {
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
  if (active < MAX) return run(req, res);
  if (queue.length >= MAX_QUEUE) {
    res.statusCode = 503;
    res.setHeader("Retry-After", "5");
    return void res.end("busy, try again in a few seconds");
  }
  // 기다리다 접속을 끊은 요청은 건너뛰어요
  queue.push(() => (req.destroyed || res.destroyed ? (queue.shift()?.(), undefined) : run(req, res)));
}).listen(port, "0.0.0.0", () => console.log(`> Ready on port ${port} (pages ${MAX} at a time)`));
