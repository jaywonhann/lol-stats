// 모든 수집기가 같은 Riot 키를 나눠 써요 (개발 키: 1초 20회, 2분 100회, 지역 서버마다 따로).
// Riot이 응답 헤더로 알려주는 "이 키로 지금까지 쓴 횟수"를 보고, 2분 안에 RESERVE 만큼은
// 사이트의 소환사 검색이 쓰도록 남겨 둬요. 넘으면 잠깐 쉬었다가 다음 요청을 보내요.
const RESERVE = Number(process.env.RIOT_RESERVE ?? 30);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function yieldToSite(res) {
  const count = res?.headers?.get("x-app-rate-limit-count");
  const limit = res?.headers?.get("x-app-rate-limit");
  if (!count || !limit) return;
  const used = Object.fromEntries(count.split(",").map((p) => p.split(":").reverse().map(Number)));
  for (const part of limit.split(",")) {
    const [max, win] = part.split(":").map(Number);
    if (win < 60) continue; // 1초 한도는 각 수집기의 간격으로 지켜요
    const n = used[win] ?? 0;
    if (n >= max - RESERVE) await sleep(Math.min(15_000, 2_000 + (n - (max - RESERVE)) * 1_000));
  }
}
