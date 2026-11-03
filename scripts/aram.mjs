// 증바람(증강 칼바람, ARAM: Mayhem)과 일반 칼바람 게임을 모아 챔피언별 템트리·증강 승률을 집계합니다.
// 랭크 수집(collect.yml)과 겹치지 않는 시간에 돌아서 솔랭 표본은 줄지 않아요.
// 결과: data/aram/{server}/{patch}.json, data/aram/augments.json (증강 이름·아이콘)
import fs from "node:fs";
import path from "node:path";
import { yieldToSite } from "./rate.mjs";

const KEY = process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/gi)?.at(-1) ?? process.env.RIOT_API_KEY?.trim();
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 40);
const PLAYERS = Number(process.env.PLAYERS ?? 300);
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 80);
const SERVERS = { kr: "asia", na1: "americas", euw1: "europe" };
const SERVER = process.env.SERVER ?? "kr";
const PLATFORM = `https://${SERVER}.api.riotgames.com`;
const REGION = `https://${SERVERS[SERVER]}.api.riotgames.com`;
const DDRAGON = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org/latest";
// 2400 = ARAM: Mayhem (증바람), 450 = 일반 칼바람
const MODES = { 2400: "mayhem", 450: "aram" };
const DIR = path.join(process.cwd(), "data", "aram");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const timeLeft = () => MAX_MINUTES * 60_000 - (Date.now() - started);
const calls = [];
async function riot(url) {
  for (;;) {
    const now = Date.now();
    while (calls.length && now - calls[0] > 120_000) calls.shift();
    if (calls.length >= RATE_LIMIT) {
      await sleep(120_000 - (now - calls[0]) + 50);
      continue;
    }
    if (calls.length && now - calls[calls.length - 1] < 60) await sleep(60);
    calls.push(Date.now());
    const res = await fetch(url, { headers: { "X-Riot-Token": KEY } });
    await yieldToSite(res);
    if (res.status === 429) {
      await sleep(Number(res.headers.get("retry-after") ?? 10) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      console.error(`::error::Riot API 키가 거부됐어요 (${res.status}). 개발용 키는 24시간마다 만료돼요.`);
      process.exit(1);
    }
    if (!res.ok) return null;
    return res.json();
  }
}
function bump(obj, key, win) {
  const v = (obj[key] ??= [0, 0]);
  v[0]++;
  if (win) v[1]++;
}
const read = (f, empty) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : empty);
const getJson = async (url) => {
  try {
    const r = await fetch(url);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
};

// 증강 이름·아이콘 (CommunityDragon). 아레나 데이터에 없는 증강은 클라이언트 데이터에서 찾아봅니다.
async function updateAugments(ids) {
  const file = path.join(DIR, "augments.json");
  const meta = read(file, {});
  const missing = [...ids].filter((id) => !meta[id]?.ko);
  if (!missing.length) return;
  const icon = (p) => (p ? `${CDRAGON}/game/${p.toLowerCase().replace(/\.(dds|tex)$/, ".png")}` : null);
  for (const [loc, field] of [["en_us", "en"], ["ko_kr", "ko"]]) {
    const arena = await getJson(`${CDRAGON}/cdragon/arena/${loc}.json`);
    for (const a of arena?.augments ?? []) {
      const m = (meta[a.id] ??= {});
      m[field] = a.name;
      m.icon ??= icon(a.iconLarge || a.iconSmall);
      m.rarity ??= a.rarity;
    }
    const lang = loc === "en_us" ? "default" : loc;
    const cherry = await getJson(`${CDRAGON}/plugins/rcp-be-lol-game-data/global/${lang}/v1/cherry-augments.json`);
    for (const a of cherry ?? []) {
      const m = (meta[a.id] ??= {});
      m[field] ??= a.nameTRA;
      if (!m.icon && a.augmentSmallIconPath)
        m.icon = `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/${a.augmentSmallIconPath.replace(/^\/lol-game-data\/assets\//i, "").toLowerCase()}`;
      m.rarity ??= a.rarity;
    }
  }
  const still = missing.filter((id) => !meta[id]?.en);
  if (still.length) console.log(`::notice::증강 ${still.length}개는 이름을 못 찾았어요 (예: ${still.slice(0, 5).join(", ")})`);
  for (const id of Object.keys(meta)) if (!ids.has(id) && !meta[id].en) delete meta[id];
  fs.writeFileSync(file, JSON.stringify(meta));
}

async function main() {
  if (!KEY) {
    console.error("RIOT_API_KEY 가 없어요.");
    process.exit(1);
  }
  const versions = await (await fetch(`${DDRAGON}/api/versions.json`)).json();
  const version = versions[0];
  const patch = version.split(".").slice(0, 2).join(".");
  const itemData = (await (await fetch(`${DDRAGON}/cdn/${version}/data/en_US/item.json`)).json()).data;
  const isBoots = (id) => itemData[id]?.tags?.includes("Boots") && (itemData[id]?.depth ?? 1) >= 2;
  const isCore = (id) => {
    const it = itemData[id];
    if (!it || isBoots(id) || it.tags?.includes("Consumable") || it.tags?.includes("Trinket")) return false;
    return !it.into?.length && (it.gold?.total ?? 0) >= 2000;
  };

  const dir = path.join(DIR, SERVER);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${patch}.json`);
  const db = read(file, { patch, updatedAt: null, matches: {}, champs: {} });
  const seenFile = path.join(dir, `seen-${patch}.json`);
  const seen = new Set(read(seenFile, []));

  // 1) 칼바람 계열 큐 찾기 (Riot 공식 큐 목록에서 칼바람 나락 맵 큐). 증바람은 설명에 Mayhem/증강이 들어간 큐예요.
  const queueList = (await getJson("https://static.developer.riotgames.com/docs/lol/queues.json")) ?? [];
  const modeOf = { 450: "aram", 2400: "mayhem" };
  for (const q of queueList) {
    const d = `${q.description ?? ""}`;
    if (!/howling abyss/i.test(q.map ?? "") || /custom|bot|tutorial|deprecated/i.test(d) || q.queueId === 0) continue;
    modeOf[q.queueId] ??= /mayhem|augment/i.test(d) ? "mayhem" : null;
  }
  // 이전 실행에서 직접 찾아낸 칼바람 맵 큐 (공식 목록에 아직 없는 새 모드)
  for (const [q, m] of Object.entries(read(path.join(DIR, "queues.json"), {}))) modeOf[q] ??= m;
  const QUEUES = Object.entries(modeOf).filter(([, m]) => m).map(([q]) => Number(q));
  console.log(`::notice::칼바람 큐: ${QUEUES.map((q) => `${q}=${modeOf[q]}`).join(", ")}`);

  // 2) 시작 표본: 여러 티어 랭커. 칼바람 게임을 찾으면 그 게임의 다른 9명도 이어서 조회합니다 (칼바람 하는 사람을 따라감)
  const players = [];
  const queued = new Set();
  const addPlayer = (puuid) => {
    if (puuid && !queued.has(puuid) && queued.size < 5000) {
      queued.add(puuid);
      players.push(puuid);
    }
  };
  const seeds = [];
  for (const name of ["GOLD", "PLATINUM", "SILVER", "EMERALD", "DIAMOND"]) {
    for (const div of ["I", "III"]) {
      const page = await riot(`${PLATFORM}/lol/league/v4/entries/RANKED_SOLO_5x5/${name}/${div}?page=1`);
      for (const e of page ?? []) if (e.puuid) seeds.push(e.puuid);
    }
  }
  seeds.sort(() => Math.random() - 0.5).slice(0, PLAYERS).forEach(addPlayer);

  const since = Math.floor(Date.now() / 1000) - 5 * 24 * 3600;
  const augIds = new Set(Object.values(db.champs).flatMap((c) => Object.keys(c.augments ?? {})));
  const found = {};
  let done = 0;
  let checked = 0;
  let logged = false;
  const crawlFirst = []; // 칼바람 게임에서 찾은 사람을 먼저 조회
  const aramPlayers = [];
  while (timeLeft() > 4 * 60_000) {
    const puuid = crawlFirst.shift() ?? players.shift();
    if (!puuid) break;
    checked++;
    for (const q of QUEUES) {
      const list = await riot(`${REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${q}&startTime=${since}&count=10`);
      for (const id of list ?? []) {
        if (seen.has(id) || timeLeft() < 60_000) continue;
        seen.add(id);
        const m = await riot(`${REGION}/lol/match/v5/matches/${id}`);
        if (!m?.info || m.info.gameDuration < 300 || !`${m.info.gameVersion}`.startsWith(`${patch}.`)) continue;
        const mode = modeOf[m.info.queueId] ?? modeOf[q];
        if (!mode) continue;
        found[m.info.queueId] = (found[m.info.queueId] ?? 0) + 1;
        db.matches[mode] = (db.matches[mode] ?? 0) + 1;
        for (const p of m.info.participants) {
          if (p.puuid && aramPlayers.length < 50) aramPlayers.push(p.puuid);
          if (p.puuid && !queued.has(p.puuid) && queued.size < 5000) {
            queued.add(p.puuid);
            crawlFirst.push(p.puuid);
          }
          const c = (db.champs[`${mode}:${p.championId}`] ??= { games: 0, wins: 0, items: {}, builds: {}, boots: {}, augments: {}, augSets: {}, spells: {}, runes: {} });
          const win = p.win;
          c.games++;
          if (win) c.wins++;
          const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map(String);
          const core = [...new Set(items.filter(isCore))];
          for (const it of core) bump(c.items, it, win);
          if (core.length >= 3) bump(c.builds, core.slice(0, 3).sort().join(","), win);
          const boots = items.find(isBoots);
          if (boots) bump(c.boots, boots, win);
          const augs = [1, 2, 3, 4, 5, 6].map((n) => p[`playerAugment${n}`]).filter((x) => x > 0).map(String);
          for (const x of augs) {
            bump(c.augments, x, win);
            augIds.add(x);
          }
          if (augs.length >= 2) bump(c.augSets, augs.slice(0, 2).sort().join(","), win);
          // 같은 팀 챔피언(같이 하면 잘 이기는 팀원)과 상대 팀 챔피언(만나면 힘든 상대)
          for (const o of m.info.participants) {
            if (o === p) continue;
            bump((c[o.teamId === p.teamId ? "with" : "vs"] ??= {}), String(o.championId), win);
          }
          const sp = [p.summoner1Id, p.summoner2Id].sort((x, y) => x - y);
          bump(c.spells, sp.join(","), win);
          const [pri, sec] = p.perks?.styles ?? [];
          if (pri && sec) bump(c.runes, `${pri.style}|${pri.selections.map((x) => x.perk).join(",")}|${sec.style}|${sec.selections.map((x) => x.perk).sort().join(",")}`, win);
          if (!logged && mode === "mayhem") {
            logged = true;
            const keys = Object.keys(p).filter((k) => /augment/i.test(k)).map((k) => `${k}=${p[k]}`);
            console.log(`::notice::증바람 증강 필드 확인: ${keys.join(" ") || "없음"}`);
          }
        }
        done++;
      }
    }
  }
  // 증바람 게임이 하나도 없으면, 칼바람 하는 사람들의 최근 게임을 큐 구분 없이 열어 칼바람 맵(12)의 다른 큐를 찾습니다
  if (!Object.keys(found).some((q) => modeOf[q] === "mayhem")) {
    const extra = {};
    const sample = {};
    for (const puuid of aramPlayers.slice(0, 12)) {
      if (timeLeft() < 60_000) break;
      const list = (await riot(`${REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?startTime=${since}&count=8`)) ?? [];
      for (const id of list) {
        if (timeLeft() < 60_000) break;
        const m = await riot(`${REGION}/lol/match/v5/matches/${id}`);
        if (!m?.info) continue;
        const k = `${m.info.queueId}/${m.info.gameMode}/map${m.info.mapId}`;
        sample[k] = (sample[k] ?? 0) + 1;
        if (m.info.mapId === 12 && !modeOf[m.info.queueId] && m.info.queueId !== 0) extra[m.info.queueId] = "mayhem";
      }
    }
    console.log(`::notice::${SERVER} 큐 탐색: ${JSON.stringify(sample)}`);
    if (Object.keys(extra).length) {
      const qf = path.join(DIR, "queues.json");
      fs.writeFileSync(qf, JSON.stringify({ ...read(qf, {}), ...extra }));
      console.log(`::notice::새 칼바람 맵 큐를 증바람으로 등록: ${Object.keys(extra).join(", ")}`);
    }
  }
  console.log(`::notice::${SERVER} 플레이어 ${checked}명 조회, 큐별 새 게임 ${JSON.stringify(found)}`);
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(db));
  fs.writeFileSync(seenFile, JSON.stringify([...seen].slice(-30000)));
  console.log(`::notice::${SERVER} 패치 ${patch}: 이번에 ${done}게임 분석, 누적 ${JSON.stringify(db.matches)}`);
  await updateAugments(augIds);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
