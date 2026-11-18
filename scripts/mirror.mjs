// 켜져 있는 사이트(BASE)의 페이지를 받아 정적 사본(OUT)으로 저장해요. Cloudflare에 올려 cf/worker.mjs가 보여 줍니다.
// Render 무료 전송량(월 5GB)이 다 차서 사이트가 멈춘 2026-11-18에 만들었어요. 사이트맵에 있는 주소만 받아요.
import fs from "node:fs";
import path from "node:path";
import { pageKey } from "../cf/key.mjs";

const BASE = process.env.BASE ?? "http://localhost:3999";
const SITE = process.env.NEXT_PUBLIC_SITE ?? "https://livelol.onrender.com";
const OUT = process.env.OUT ?? "/tmp/mirror";
const N = Number(process.env.CONCURRENCY ?? 4);
const LIMIT = Number(process.env.LIMIT ?? 0);
const H = { "user-agent": "curl/mirror" };

const get = async (u, tries = 3) => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + u, { headers: H, redirect: "manual", signal: AbortSignal.timeout(120_000) });
      if (r.status === 503 && i < tries) throw new Error("503");
      return r;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
};
const save = (file, body) => {
  const f = path.join(OUT, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
};

// 사이트맵·robots 는 그대로 둬요 (주소는 빌드할 때 넣은 새 주소로 이미 적혀 있어요)
const sm = await (await get("/sitemap.xml")).text();
save("sitemap.xml", sm);
save("robots.txt", await (await get("/robots.txt")).text());
let urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll("&amp;", "&").replace(SITE, "") || "/");
urls = [...new Set(["/", "/?lang=ko", ...urls])];
if (LIMIT) urls = urls.slice(0, LIMIT);

const og = new Set();
let ok = 0;
const bad = [];
async function page(u) {
  const { pathname, searchParams } = new URL(u, "http://x");
  const r = await get(u);
  if (r.status !== 200) return bad.push(`${u} ${r.status}`);
  const html = await r.text();
  save(pageKey(pathname, searchParams), html);
  ok++;
  // 공유 미리보기 그림 주소 (상성 페이지는 수가 많아서 빼요)
  const m = /<meta property="og:image" content="([^"]+)"/.exec(html);
  if (m && pathname !== "/matchup") og.add(m[1].replaceAll("&amp;", "&").replace(SITE, ""));
}
async function pool(list, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: N }, async () => {
    while (i < list.length) {
      const u = list[i++];
      try {
        await fn(u);
      } catch (e) {
        bad.push(`${u} ${e.message}`);
      }
      if (i % 500 === 0) console.log(`${i}/${list.length}`);
    }
  }));
}
await pool(urls, page);

// 없는 주소에 보여 줄 화면
for (const lang of ["", "ko"]) {
  const r = await get(`/__none${lang ? "?lang=ko" : ""}`);
  save(`/_p/404${lang ? ".ko" : ""}.html`, await r.text());
}
// 공유 그림: 주소 그대로(물음표 뒤는 빼고) .png 를 붙여 저장해요
let img = 0;
await pool([...og].filter((u) => u.startsWith("/")), async (u) => {
  const r = await get(u);
  if (r.status !== 200 || !(r.headers.get("content-type") ?? "").startsWith("image/")) return bad.push(`${u} ${r.status}`);
  save(`/_p${u.split("?")[0]}.png`, Buffer.from(await r.arrayBuffer()));
  img++;
});

// 짧은 주소(/yasuo, /야스오-vs-요네)용 챔피언 이름표
try {
  const dd = process.env.DDRAGON_BASE ?? "https://ddragon.leagueoflegends.com";
  const j = async (p) => (await fetch(dd + p, { signal: AbortSignal.timeout(20_000) })).json();
  const [ver] = await j("/api/versions.json");
  const slug = {};
  const slugOf = (v) => v.toLowerCase().replace(/[\s'.&_-]/g, "");
  for (const loc of ["ko_KR", "en_US"]) for (const c of Object.values((await j(`/cdn/${ver}/data/${loc}/champion.json`)).data)) slug[slugOf(c.name)] = slug[slugOf(c.id)] = c.id;
  save("/_p/slugs.json", JSON.stringify(slug));
} catch (e) {
  bad.push(`slugs ${e.message}`);
}
save("/_p/built.json", JSON.stringify({ at: new Date().toISOString(), pages: ok, images: img }));
console.log(`pages=${ok} images=${img} bad=${bad.length}`);
console.log(bad.slice(0, 30).join("\n"));
if (ok < urls.length * 0.95) process.exit(1);
