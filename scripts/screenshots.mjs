// 실제 사이트 홍보용 스크린샷 (GitHub Actions에서 실행). 결과는 shots/ 에 저장.
import { chromium } from "playwright";

const B = process.env.SITE ?? "https://lollive.vercel.app";
const LANG = process.env.SHOT_LANG ?? "ko";
const BLOG = [
  { name: "blog-1-home", path: "/", wait: 6000 },
  { name: "blog-2-tier", path: "/tier", wait: 4000 },
  { name: "blog-3-champion", path: "/champions/Lillia?lane=jungle", wait: 4000 },
  { name: "blog-4-meta", path: "/meta?lane=jungle", wait: 4000 },
  { name: "blog-5-summoner", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 5000 },
  { name: "blog-6-duo", path: "/duo", wait: 4000 },
  { name: "blog-7-aram", path: "/aram", wait: 4000 },
  { name: "blog-8-mobile-home", path: "/", wait: 6000, mobile: true },
];
const DEFAULT = [
  { name: "1-home", path: "/", wait: 9000 },
  { name: "2-summoner", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 4000 },
  { name: "3-champion", path: "/champions/Ahri?lane=mid", wait: 4000 },
  { name: "4-meta", path: "/meta?lane=jungle", wait: 4000 },
  { name: "5-app", path: "/app?champ=103&lane=mid", wait: 4000 },
  { name: "6-download", path: "/download", wait: 2000 },
];
const shots = process.env.SHOT_SET === "blog" ? BLOG : DEFAULT;

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext(
    s.mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 },
  );
  await ctx.addCookies([
    { name: "lang", value: LANG, url: B },
    { name: "server", value: "kr", url: B },
  ]);
  const page = await ctx.newPage();
  try {
    await page.goto(B + s.path, { waitUntil: "networkidle", timeout: 90_000 });
  } catch (e) {
    console.log(`::warning::${s.name} 로딩 시간 초과, 그대로 찍습니다: ${e.message}`);
  }
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `${process.env.OUT ?? "shots"}/${LANG}-${s.name}.png` });
  console.log(`::notice::${LANG}-${s.name} 저장`);
  await ctx.close();
}
await browser.close();
