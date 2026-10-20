// 서버별로 지금 게임 중인 전체 플레이어 수를 추정해서 OUT/{server}.json 에 기록을 이어 붙입니다.
// 전체 인원은 게임 ID가 서버 전체에서 순서대로 매겨지는 점을 이용해요: 표본 게임의 (게임 ID, 시작 시각)으로
// "분당 새 게임 수"를 구하고, 거기에 평균 게임 시간과 10명을 곱합니다 (모든 큐 포함, 추정치).
// GitHub Actions(live-history.yml)에서 10분마다 실행되고, 결과는 live-data 브랜치에 올라가요.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const KEY = (process.env.RIOT_API_KEY ?? "").match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();
const OUT = process.env.OUT ?? "live-data";
const SAMPLE = Number(process.env.SAMPLE ?? 80);
const GAMES_KEEP_MS = 6 * 3_600_000; // 지금 많이 쓰는 챔피언·룬·스펠용: 최근 6시간 게임만 보관
const KEEP_MS = 7 * 24 * 3_600_000;
const PAIRS_KEEP_MS = 90 * 60_000; // 게임 ID-시작 시각 쌍은 90분 보관
const RATE_WINDOW_MS = 60 * 60_000; // 최근 1시간 안에 시작한 게임으로 속도를 계산
const AVG_GAME_MIN = 28; // 모든 큐 평균 게임 시간(분)
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
  const pairs = [];
  for (const puuid of pick) {
    const res = await riot(`https://${server}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`);
    if (res?.status === 200) {
      checked++; inGame++;
      // 진행 중인 게임의 챔피언 10명 (솔로/자유 랭크만)
      const g = await res.json().catch(() => null);
      if (g?.gameId && g.gameStartTime > 0) pairs.push([g.gameId, g.gameStartTime]);
      // 표본 두 명이 같은 게임에 있으면 한 번만 센다
      if (g && (g.gameQueueConfigId === 420 || g.gameQueueConfigId === 440) && !games.some((x) => x.id === g.gameId))
        games.push({
          id: g.gameId,
          champs: (g.participants ?? []).map((x) => x.championId).filter(Boolean),
          // 참가자별 [챔피언, 스펠1, 스펠2, 룬 주 계열, 룬 보조 계열, ...룬 ID]
          ps: (g.participants ?? [])
            .filter((x) => x.championId && x.perks?.perkIds?.length)
            .map((x) => [x.championId, x.spell1Id, x.spell2Id, x.perks.perkStyle, x.perks.perkSubStyle, ...x.perks.perkIds]),
        });
    }
    else if (res?.status === 404) checked++;
    await sleep(120);
  }
  if (!checked) return null;
  return { games, pairs, at: new Date().toISOString(), estimate: Math.round((inGame / checked) * all.length), inGame, checked, total: all.length };
}

let bad = false;
for (const server of SERVERS) {
  const file = `${OUT}/${server}.json`;
  let points = [];
  let games = [];
  let pairs = [];
  try {
    if (existsSync(file)) {
      const old = JSON.parse(readFileSync(file, "utf8"));
      points = old.points ?? [];
      games = old.games ?? [];
      pairs = old.pairs ?? [];
    }
  } catch {}
  try {
    const p = await sample(server);
    if (p) {
      const { games: found, pairs: foundPairs, ...point } = p;
      const known = new Set(pairs.map((x) => x[0]));
      for (const x of foundPairs) if (!known.has(x[0])) pairs.push(x);
      pairs = pairs.filter((x) => Date.now() - x[1] < PAIRS_KEEP_MS);
      // 전체 인원 추정: 새 게임이 분당 몇 개 생기는지 (게임 ID ~ 시작 시각 직선의 기울기)
      const recent = pairs.filter((x) => Date.now() - x[1] < RATE_WINDOW_MS);
      const spanMin = recent.length ? (Math.max(...recent.map((x) => x[1])) - Math.min(...recent.map((x) => x[1]))) / 60_000 : 0;
      if (recent.length >= 8 && spanMin >= 10) {
        const n = recent.length;
        const mx = recent.reduce((a, x) => a + x[1], 0) / n;
        const my = recent.reduce((a, x) => a + x[0], 0) / n;
        const slope = recent.reduce((a, x) => a + (x[1] - mx) * (x[0] - my), 0) / recent.reduce((a, x) => a + (x[1] - mx) ** 2, 0);
        const perMin = slope * 60_000;
        if (perMin > 0) {
          point.v = 2;
          point.gamesPerMin = Math.round(perMin);
          point.master = point.estimate; // 예전 방식(마스터+ 랭커 수)도 참고로 남김
          point.estimate = Math.round(perMin * AVG_GAME_MIN * 10);
          point.total = 0;
        }
      }
      points.push(point);
      const seen = new Set(games.map((g) => g.id));
      for (const g of found) if (!seen.has(g.id)) games.push({ ...g, at: point.at });
      console.log(`::notice::${server} 전체 약 ${points.at(-1)?.v === 2 ? points.at(-1).estimate + '명' : '(표본 부족)'} 게임 중, 분당 새 게임 ${points.at(-1)?.gamesPerMin ?? '-'}개 (마스터+ ${p.inGame}/${p.checked}, 표본 게임 ${pairs.length}쌍)`);
    } else console.log(`::warning::${server} 표본을 못 얻었어요.`);
  } catch (e) {
    if (e.message === "key") { console.log("::warning::Riot 키가 거절됐어요. 새 키로 바꿔 주세요."); bad = true; break; }
    console.log(`::warning::${server} ${e.message}`);
  }
  points = points.filter((p) => Date.now() - new Date(p.at).getTime() < KEEP_MS);
  games = games.filter((g) => Date.now() - new Date(g.at).getTime() < GAMES_KEEP_MS);
  writeFileSync(file, JSON.stringify({ server, updatedAt: new Date().toISOString(), points, games, pairs }));
}
// 키가 거절되면 3으로 끝내서, 워크플로가 새 실행(새 키를 받는)으로 넘어가게 합니다
if (bad) process.exit(3);
