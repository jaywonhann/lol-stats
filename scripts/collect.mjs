// 한국 서버 상위 랭크(마스터+, 다이아 I~II) 솔로랭크 게임을 모아서 챔피언별 빌드·승률을 집계합니다.
// GitHub Actions에서 RIOT_API_KEY 시크릿으로 실행되고, 결과는 data/patches/{패치}.json 에 쌓입니다.
//   RIOT_API_KEY=RGAPI-... node scripts/collect.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 시크릿에 키 외의 글자(공백, 메모 등)가 같이 들어가도 키 부분만 사용
const KEY = process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 50);
const PLAYERS = Number(process.env.PLAYERS ?? 400);
const DATA_DIR = path.join(process.cwd(), "data");
const PLATFORM = "https://kr.api.riotgames.com";
const REGION = "https://asia.api.riotgames.com";
const DDRAGON = "https://ddragon.leagueoflegends.com";

const started = Date.now();
const timeLeft = () => MAX_MINUTES * 60_000 - (Date.now() - started);

// 개발용 키 제한: 1초 20회, 2분 100회. 여유 있게 2분 95회로 맞춥니다.
const calls = [];
async function riot(url) {
  for (;;) {
    const now = Date.now();
    while (calls.length && now - calls[0] > 120_000) calls.shift();
    if (calls.length >= 95) {
      await sleep(120_000 - (now - calls[0]) + 50);
      continue;
    }
    if (calls.length && now - calls[calls.length - 1] < 60) await sleep(60);
    calls.push(Date.now());
    const res = await fetch(url, { headers: { "X-Riot-Token": KEY } });
    if (res.status === 429) {
      await sleep(Number(res.headers.get("retry-after") ?? 10) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      console.error(`Riot API 키가 거부됐어요 (${res.status}). 개발용 키는 24시간마다 만료되니 새로 발급해서 시크릿을 바꿔 주세요.`);
      process.exit(1);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`요청 실패 ${res.status}: ${url}`);
      await sleep(1000);
      return null;
    }
    return res.json();
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const patchOf = (v) => v.split(".").slice(0, 2).join(".");

const LANE = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "bottom", UTILITY: "support" };

async function main() {
  if (!KEY) {
    console.error("RIOT_API_KEY 가 없어요. GitHub 저장소 Settings > Secrets 에 추가해 주세요.");
    process.exit(1);
  }
  // 최신 패치와 아이템 정보 (완성 아이템/신발 판별용)
  const versions = await (await fetch(`${DDRAGON}/api/versions.json`)).json();
  const version = versions[0];
  const patch = patchOf(version);
  const itemData = (await (await fetch(`${DDRAGON}/cdn/${version}/data/en_US/item.json`)).json()).data;
  const isBoots = (id) => itemData[id]?.tags?.includes("Boots") && (itemData[id]?.depth ?? 1) >= 2;
  const isTrinket = (id) => itemData[id]?.tags?.includes("Trinket") ?? false;
  const isCore = (id) => {
    const it = itemData[id];
    if (!it || isBoots(id) || it.tags?.includes("Consumable") || it.tags?.includes("Trinket")) return false;
    return !it.into?.length && (it.gold?.total ?? 0) >= 2000;
  };
  console.log(`패치 ${patch} (${version}) 수집 시작, 최대 ${MAX_MINUTES}분`);

  const file = path.join(DATA_DIR, "patches", `${patch}.json`);
  const db = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { patch, updatedAt: null, matches: 0, bans: {}, champs: {}, seen: [] };
  const seen = new Set(db.seen);

  // 1) 상위 랭커 목록
  const entries = [];
  for (const tier of ["challengerleagues", "grandmasterleagues", "masterleagues"]) {
    const league = await riot(`${PLATFORM}/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`);
    if (league?.entries) entries.push(...league.entries);
  }
  for (const div of ["I", "II"]) {
    const page = await riot(`${PLATFORM}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/${div}?page=1`);
    if (page) entries.push(...page);
  }
  const puuids = [...new Set(entries.map((e) => e.puuid).filter(Boolean))].sort(() => Math.random() - 0.5).slice(0, PLAYERS);
  console.log(`랭커 ${puuids.length}명`);

  // 2) 최근 7일 솔로랭크 게임 ID
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const queue = [];
  for (const puuid of puuids) {
    if (timeLeft() < 0.6 * MAX_MINUTES * 60_000) break; // 시간의 40%까지만 ID 수집에 사용
    const ids = await riot(`${REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&startTime=${since}&count=20`);
    for (const id of ids ?? []) if (!seen.has(id) && !queue.includes(id)) queue.push(id);
  }
  console.log(`새 게임 후보 ${queue.length}개`);

  // 3) 게임 상세 + 타임라인 집계
  let added = 0;
  for (const id of queue) {
    if (timeLeft() < 60_000) break;
    seen.add(id);
    const match = await riot(`${REGION}/lol/match/v5/matches/${id}`);
    if (!match || patchOf(match.info.gameVersion) !== patch || match.info.gameDuration < 900) continue;
    const timeline = await riot(`${REGION}/lol/match/v5/matches/${id}/timeline`);
    if (!timeline) continue;
    addMatch(db, match, timeline, { isBoots, isCore, isTrinket });
    added++;
    if (added % 50 === 0) console.log(`  ${added}게임 집계`);
  }

  // 파일이 너무 커지지 않게 항목별 상위 40개만 유지
  for (const c of Object.values(db.champs)) {
    for (const k of ["runes", "spells", "starters", "core", "boots", "skills"]) {
      c[k] = Object.fromEntries(Object.entries(c[k]).sort((a, b) => b[1][0] - a[1][0]).slice(0, 40));
    }
  }
  db.seen = [...seen].slice(-20000);
  db.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(db));
  console.log(`완료: 이번에 ${added}게임 추가, 패치 ${patch} 누적 ${db.matches}게임`);
}

function bump(obj, key, win) {
  const v = (obj[key] ??= [0, 0]);
  v[0]++;
  if (win) v[1]++;
}

export function addMatch(db, match, timeline, { isBoots, isCore, isTrinket = () => false }) {
  db.matches++;
  // 두 팀이 같은 챔피언을 밴해도 한 게임에 한 번만 셉니다
  const banned = new Set(match.info.teams.flatMap((t) => t.bans.map((b) => b.championId)).filter((id) => id > 0));
  for (const id of banned) db.bans[id] = (db.bans[id] ?? 0) + 1;

  // 참가자별 구매/스킬 기록
  const buys = {}; // participantId -> [{t, id}]
  const skills = {}; // participantId -> [slot]
  for (const frame of timeline.info.frames) {
    for (const e of frame.events) {
      if (e.type === "ITEM_PURCHASED") (buys[e.participantId] ??= []).push({ t: e.timestamp, id: String(e.itemId) });
      if (e.type === "ITEM_UNDO") {
        const list = buys[e.participantId] ?? [];
        const i = list.findLastIndex((x) => x.id === String(e.beforeId));
        if (i >= 0) list.splice(i, 1);
      }
      if (e.type === "SKILL_LEVEL_UP" && e.levelUpType === "NORMAL") (skills[e.participantId] ??= []).push(e.skillSlot);
    }
  }

  const ps = match.info.participants;
  for (const p of ps) {
    const lane = LANE[p.teamPosition];
    if (!lane) continue;
    const c = (db.champs[`${p.championId}:${lane}`] ??= { games: 0, wins: 0, runes: {}, spells: {}, starters: {}, core: {}, boots: {}, skills: {}, vs: {} });
    const win = p.win;
    c.games++;
    if (win) c.wins++;

    const [pri, sec] = p.perks.styles;
    bump(c.runes, `${pri.style}|${pri.selections.map((s) => s.perk).join(",")}|${sec.style}|${sec.selections.map((s) => s.perk).sort().join(",")}`, win);
    // 점멸은 항상 앞에
    const sp = [p.summoner1Id, p.summoner2Id].sort((a, b) => (a === 4 ? -1 : b === 4 ? 1 : a - b));
    bump(c.spells, sp.join(","), win);

    const list = buys[p.participantId] ?? [];
    const start = list.filter((x) => x.t < 60_000 && !isTrinket(x.id)).map((x) => x.id).sort();
    if (start.length) bump(c.starters, start.join(","), win);
    const core = [...new Set(list.filter((x) => isCore(x.id)).map((x) => x.id))].slice(0, 3);
    if (core.length === 3) bump(c.core, core.join(","), win);
    const boots = list.find((x) => isBoots(x.id));
    if (boots) bump(c.boots, boots.id, win);

    // 스킬 선마 순서: Q/W/E 중 5레벨을 먼저 찍은 순서
    const lv = { 1: 0, 2: 0, 3: 0 };
    const order = [];
    for (const s of skills[p.participantId] ?? []) {
      if (s > 3) continue;
      lv[s]++;
      if (lv[s] === 5) order.push("QWE"[s - 1]);
    }
    if (order.length >= 2) {
      const rest = ["Q", "W", "E"].filter((k) => !order.includes(k));
      bump(c.skills, [...order, ...rest].join(""), win);
    }

    const opp = ps.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition);
    if (opp) bump(c.vs, String(opp.championId), win);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
