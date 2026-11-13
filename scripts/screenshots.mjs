// 실제 사이트 홍보용 스크린샷 (GitHub Actions에서 실행). 결과는 shots/ 에 저장.
import { chromium } from "playwright";

const B = process.env.SITE ?? "https://livelol.onrender.com";
const LANG = process.env.SHOT_LANG ?? "ko";
const SET = process.env.SHOT_SET ?? "blog";
const blogShots = [
  // 블로그 글 [사진] 자리 순서대로
  { name: "1-home", path: "/", wait: 9000 },
  { name: "2-tier", path: "/tier", wait: 4000 },
  { name: "3-champion", path: "/champions/Ahri?lane=mid", wait: 4000 },
  { name: "4-summoner", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 5000 },
  { name: "5-pros", path: "/pros", wait: 5000 },
];
// Threads용: 휴대폰 화면 크기, 세로 사진. el 이 있으면 그 패널만 잘라서 찍어요.
const threadsShots = [
  { name: "t1-mental-faker", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 6000, el: "지금 큐 돌려도 될까?" },
  { name: "t1-mental-gumayusi", path: "/summoner?id=T1%20Gumayusi%23KR1", wait: 6000, el: "지금 큐 돌려도 될까?" },
  { name: "t2-summoner-faker", path: "/summoner?id=Hide%20on%20bush%23KR1", wait: 6000 },
  { name: "t2-summoner-gumayusi", path: "/summoner?id=T1%20Gumayusi%23KR1", wait: 6000 },
  { name: "t3-home", path: "/", wait: 8000 },
  { name: "t4-bans-wasted", path: "/bans", wait: 3000, el: "밴 낭비일 수도 있는 챔피언" },
  { name: "t5-bans-top", path: "/bans", wait: 3000, el: "지금 밴하면 좋은 챔피언 TOP 10" },
  { name: "t6-multi", path: "/multi", wait: 3000 },
];
const shots = SET === "threads" ? threadsShots : blogShots;
const phone = SET === "threads";

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 430, height: 860 } : { width: 1200, height: 1500 }, deviceScaleFactor: phone ? 3 : 2 });
  await ctx.addCookies([
    { name: "lang", value: LANG, url: B },
    { name: "server", value: "kr", url: B },
  ]);
  const page = await ctx.newPage();
  await page.goto(B + s.path, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(s.wait);
  const file = `${process.env.OUT ?? "shots"}/${LANG}-${s.name}.png`;
  if (s.el) {
    const h = page.getByRole("heading", { name: s.el }).first();
    if ((await h.count()) === 0) { console.log(`::warning::${s.name}: 패널 없음`); await ctx.close(); continue; }
    const panel = h.locator("xpath=..");
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file });
  }
  console.log(`::notice::${LANG}-${s.name} 저장`);
  await ctx.close();
}
await browser.close();
