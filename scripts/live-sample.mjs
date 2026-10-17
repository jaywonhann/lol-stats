// 서버별로 지금 게임 중인 마스터+ 랭커 수를 추정해서 OUT/{server}.json 에 기록을 이어 붙입니다.
// GitHub Actions(live-history.yml)에서 10분마다 실행되고, 결과는 live-data 브랜치에 올라가요.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const KEY = (process.env.RIOT_API_KEY ?? "").match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();
const OUT = process.env.OUT ?? "live-data";
const SAMPLE = Number(process.env.SAMPLE ?? 80);
const GAMES_KEEP_MS = 2 * 3_600_000; // 지금 많이 하는 챔피언용: 최근 2시간 게임만 보관
const KEEP_MS = 7 * 24 * 3_600_000;
const SERVERS = ["kr", "na1", "euw1"];
if (!KEY) {
  console.log("::warning::RIOT_API_KEY 가 없어서 건너뜁니다.");
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function riot(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { "X-Riot-Token": KEY } });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 5) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error("key");
    return res;
  }
  return null;
}

async function sample(server) {
  const all = [];
  for (const l of ["challengerleagues", "grandmasterleagues", "masterleagues"]) {
    const res = await riot(`https://${server}.api.riotgames.com/lol/league/v4/${l}/by-queue/RANKED_SOLO_5x5`);
    if (!res?.ok) continue;
    const data = await res.json();
    all.push(...data.entries.map((e) => e.puuid).filter(Boolean));
  }
  if (!all.length) return null;
  const pick = [...all].sort(() => Math.random() - 0.5).slice(0, SAMPLE);
  let checked = 0, inGame = 0;
  const games = [];
  for (const puuid of pick) {
    const res = await riot(`https://${server}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`);
    if (res?.status === 200) {
      checked++; inGame++;
      // 진행 중인 게임의 챔피언 10명 (솔로/자유 랭크만)
      const g = await res.json().catch(() => null);
      // 표본 두 명이 같은 게임에 있으면 한 번만 센다
      if (g && (g.gameQueueConfigId === 420 || g.gameQueueConfigId === 440) && !games.some((x) => x.id === g.gameId))
        games.push({ id: g.gameId, champs: (g.participants ?? []).map((x) => x.championId).filter(Boolean) });
    }
    else if (res?.status === 404) checked++;
    await sleep(120);
  }
  if (!checked) return null;
  return { games, at: new Date().toISOString(), estimate: Math.round((inGame / checked) * all.length), inGame, checked, total: all.length };
}

let bad = false;
for (const server of SERVERS) {
  const file = `${OUT}/${server}.json`;
  let points = [];
  let games = [];
  try {
    if (existsSync(file)) {
      const old = JSON.parse(readFileSync(file, "utf8"));
      points = old.points ?? [];
      games = old.games ?? [];
    }
  } catch {}
  try {
    const p = await sample(server);
    if (p) {
      const { games: found, ...point } = p;
      points.push(point);
      const seen = new Set(games.map((g) => g.id));
      for (const g of found) if (!seen.has(g.id)) games.push({ ...g, at: point.at });
      console.log(`::notice::${server} 약 ${p.estimate}명 게임 중 (${p.inGame}/${p.checked}, 전체 ${p.total})`);
    } else console.log(`::warning::${server} 표본을 못 얻었어요.`);
  } catch (e) {
    if (e.message === "key") { console.log("::warning::Riot 키가 거절됐어요. 새 키로 바꿔 주세요."); bad = true; break; }
    console.log(`::warning::${server} ${e.message}`);
  }
  points = points.filter((p) => Date.now() - new Date(p.at).getTime() < KEEP_MS);
  games = games.filter((g) => Date.now() - new Date(g.at).getTime() < GAMES_KEEP_MS);
  writeFileSync(file, JSON.stringify({ server, updatedAt: new Date().toISOString(), points, games }));
}
// 키가 거절되면 3으로 끝내서, 워크플로가 새 실행(새 키를 받는)으로 넘어가게 합니다
if (bad) process.exit(3);
