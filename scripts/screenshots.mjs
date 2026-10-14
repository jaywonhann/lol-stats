// 실제 사이트 홍보용 스크린샷 (GitHub Actions에서 실행). 결과는 shots/ 에 저장.
import { chromium } from "playwright";

const B = process.env.SITE ?? "https://lol-stats-one.vercel.app";
const LANG = process.env.SHOT_LANG ?? "ko";
const shots = [
  { name: "1-home", path: "/", wait: 9000 },
  { name: "2-summoner", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 4000 },
  { name: "3-champion", path: "/champions/Ahri?lane=mid", wait: 4000 },
  { name: "4-meta", path: "/meta?lane=jungle", wait: 4000 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  await ctx.addCookies([
    { name: "lang", value: LANG, url: B },
    { name: "server", value: "kr", url: B },
  ]);
  const page = await ctx.newPage();
  await page.goto(B + s.path, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `${process.env.OUT ?? "shots"}/${LANG}-${s.name}.png` });
  console.log(`::notice::${LANG}-${s.name} 저장`);
  await ctx.close();
}
await browser.close();
