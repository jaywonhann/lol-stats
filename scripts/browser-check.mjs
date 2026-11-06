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
