// 실제 브라우저(크롬)로 페이지를 열어 체감 속도를 잽니다: 첫 글자, 큰 그림(LCP), 다 열림, 느린 파일 TOP 5.
import { chromium } from "playwright";
const SITE = process.env.SITE ?? "https://livelol.onrender.com";
const pages = (process.env.PAGES ?? "/,/tier,/champions/Jinx").split(",");
const b = await chromium.launch();
for (const p of pages) {
  for (const round of ["cold", "warm"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
    const page = await ctx.newPage();
    const res = [];
    page.on("requestfinished", async (r) => {
      const t = r.timing();
      const s = await r.sizes().catch(() => ({ responseBodySize: 0 }));
      res.push({ url: r.url().replace(SITE, "").slice(0, 70), ms: Math.round(t.responseEnd), kb: Math.round(s.responseBodySize / 1024) });
    });
    const t0 = Date.now();
    await page.goto(SITE + p, { waitUntil: "load", timeout: 120000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    const m = await page.evaluate(() => new Promise((ok) => {
      const nav = performance.getEntriesByType("navigation")[0];
      let lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => ok({ ttfb: Math.round(nav.responseStart), fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0), lcp: Math.round(lcp), dcl: Math.round(nav.domContentLoadedEventEnd) }), 1500);
    })).catch(() => ({}));
    const total = res.reduce((a, r) => a + r.kb, 0);
    const slow = res.sort((a, b) => b.ms - a.ms).slice(0, 5).map((r) => `${r.url} ${r.ms}ms ${r.kb}KB`).join(" ; ");
    console.log(`::notice title=${p} ${round}::load ${loadMs}ms ttfb ${m.ttfb} fcp ${m.fcp} lcp ${m.lcp} dcl ${m.dcl} | ${res.length} files ${total}KB | slowest: ${slow}`);
    await ctx.close();
  }
}
await b.close();

// 페이지 넘기기: 처음 연 페이지에서 링크를 눌러 다음 페이지가 다 그려질 때까지의 시간 (사람이 실제로 느끼는 이동 속도)
if (process.env.NAV) {
  const b2 = await chromium.launch();
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  const rsc = [];
  page.on("response", async (r) => {
    if (!r.url().includes("_rsc") && r.request().headers()["rsc"] !== "1") return;
    const h = r.headers();
    rsc.push(`${r.url().replace(SITE, "").split("?_rsc")[0].slice(0, 50)} ${r.status()} cache=${h["x-page-cache"] ?? "-"} ${Math.round(r.request().timing().responseEnd)}ms`);
  });
  await page.goto(SITE + "/", { waitUntil: "load", timeout: 120000 }).catch(() => {});
  for (const path of process.env.NAV.split(",")) {
    rsc.length = 0;
    const t0 = Date.now();
    const link = page.locator(`a[href="${path}"]`).first();
    const visible = await link.count();
    if (visible) await link.evaluate((a) => a.click());
    else await page.evaluate((p) => { const a = document.createElement("a"); a.href = p; document.body.appendChild(a); a.click(); }, path);
    await page.waitForURL((u) => u.pathname + u.search === path, { timeout: 60000 }).catch(() => {});
    const urlMs = Date.now() - t0;
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    console.log(`::notice title=nav ${path}::url ${urlMs}ms idle ${Date.now() - t0}ms link=${visible ? "real" : "synthetic"} | ${rsc.join(" ; ")}`);
  }
  await b2.close();
}
