// 서버 하나(SERVER)의 에메랄드·다이아몬드·마스터+ 솔로랭크 게임을 모아서 챔피언별 빌드·승률을 집계합니다.
// GitHub Actions에서 RIOT_API_KEY 시크릿으로 실행되고, 결과는 data/patches/{서버}/{랭크}/{패치}.json 에 쌓입니다.
//   RIOT_API_KEY=RGAPI-... SERVER=kr node scripts/collect.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 시크릿에 키 외의 글자(공백, 메모 등)가 같이 들어가도 키 부분만 사용
const KEY = process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 50);
const PLAYERS = Number(process.env.PLAYERS ?? 400);
const DATA_DIR = path.join(process.cwd(), "data");
// 서버별 API 주소 (게임 기록은 대륙 단위 주소를 씁니다)
const SERVERS = { kr: "asia", na1: "americas", euw1: "europe" };
const SERVER = process.env.SERVER ?? "kr";
if (!SERVERS[SERVER]) throw new Error(`알 수 없는 서버: ${SERVER}`);
const PLATFORM = `https://${SERVER}.api.riotgames.com`;
const REGION = `https://${SERVERS[SERVER]}.api.riotgames.com`;
const TIERS = ["emerald", "diamond", "master"];
const DDRAGON = "https://ddragon.leagueoflegends.com";

const started = Date.now();
const timeLeft = () => MAX_MINUTES * 60_000 - (Date.now() - started);

// 개발용 키 제한: 1초 20회, 2분 100회. 여유 있게 2분 95회로 맞춥니다.
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
// 사이트의 실시간 인원 확인도 같은 키를 쓰므로 여유를 남겨 둡니다
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 80);
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

  // 랭크 구간마다 따로 쌓고, 이미 본 게임 목록은 서버 단위로 공유합니다
  const dir = path.join(DATA_DIR, "patches", SERVER);
  const read = (f, empty) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : empty);
  const fileOf = (tier) => path.join(dir, tier, `${patch}.json`);
  const dbs = Object.fromEntries(
    TIERS.map((t) => [t, read(fileOf(t), { patch, updatedAt: null, matches: 0, bans: {}, champs: {} })]),
  );
  const seenFile = path.join(dir, `seen-${patch}.json`);
  const seen = new Set(read(seenFile, []));
  // 시간대별 게임 수 (게임 시작 시각, UTC 기준 "YYYY-MM-DDTHH")
  const activityFile = path.join(dir, "activity.json");
  const activity = read(activityFile, { hours: {} });
  // 날짜별(한국 시간) 챔피언 게임 수·승리와 코어템 두 개 조합 (픽 추이·빌드 추이 그래프용, 랭크 구간 합산)
  const dailyFile = path.join(dir, "daily.json");
  const daily = read(dailyFile, { days: {} });

  // 1) 구간별 랭커 목록
  const seeds = { emerald: [], diamond: [], master: [] };
  for (const league of ["challengerleagues", "grandmasterleagues", "masterleagues"]) {
    const l = await riot(`${PLATFORM}/lol/league/v4/${league}/by-queue/RANKED_SOLO_5x5`);
    if (l?.entries) seeds.master.push(...l.entries);
  }
  for (const [tier, name] of [["diamond", "DIAMOND"], ["emerald", "EMERALD"]]) {
    for (const div of ["I", "II", "III", "IV"]) {
      const page = await riot(`${PLATFORM}/lol/league/v4/entries/RANKED_SOLO_5x5/${name}/${div}?page=1`);
      if (page) seeds[tier].push(...page);
    }
  }
  const shuffle = (a) => a.sort(() => Math.random() - 0.5);
  const per = Math.floor(PLAYERS / TIERS.length);
  const picked = TIERS.map((t) => shuffle([...new Set(seeds[t].map((e) => e.puuid).filter(Boolean))]).slice(0, per).map((puuid) => ({ puuid, tier: t })));
  // 구간을 번갈아 가며 조회해 시간이 끊겨도 고르게 모이게
  const players = [];
  for (let i = 0; i < per; i++) for (const list of picked) if (list[i]) players.push(list[i]);
  console.log(`서버 ${SERVER} 랭커 ${players.length}명 (${TIERS.map((t, i) => `${t} ${picked[i].length}`).join(", ")})`);

  // 2) 최근 7일 솔로랭크 게임 ID (처음 찾은 랭커의 구간으로 분류)
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const queue = new Map();
  for (const { puuid, tier } of players) {
    if (timeLeft() < 0.6 * MAX_MINUTES * 60_000) break; // 시간의 40%까지만 ID 수집에 사용
    const ids = await riot(`${REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&startTime=${since}&count=20`);
    for (const id of ids ?? []) if (!seen.has(id) && !queue.has(id)) queue.set(id, tier);
  }
  console.log(`새 게임 후보 ${queue.size}개`);

  // 게임을 구간별로 번갈아 처리
  const byTier = TIERS.map((t) => [...queue].filter(([, tier]) => tier === t).map(([id]) => [id, t]));
  const order = [];
  for (let i = 0; byTier.some((l) => l[i]); i++) for (const l of byTier) if (l[i]) order.push(l[i]);

  // 3) 게임 상세 + 타임라인 집계
  let added = 0;
  for (const [id, tier] of order) {
    if (timeLeft() < 60_000) break;
    seen.add(id);
    const match = await riot(`${REGION}/lol/match/v5/matches/${id}`);
    if (!match || patchOf(match.info.gameVersion) !== patch || match.info.gameDuration < 900) continue;
    const timeline = await riot(`${REGION}/lol/match/v5/matches/${id}/timeline`);
    if (!timeline) continue;
    const picks = addMatch(dbs[tier], match, timeline, { isBoots, isCore, isTrinket });
    const day = new Date(match.info.gameStartTimestamp + 9 * 3600_000).toISOString().slice(0, 10);
    const d = (daily.days[day] ??= { matches: 0, champs: {} });
    d.matches++;
    for (const { key, win, core } of picks) {
      const e = (d.champs[key] ??= [0, 0, {}]);
      e[0]++;
      if (win) e[1]++;
      if (core.length >= 2) bump(e[2], core.slice(0, 2).join(","), win);
    }
    const hour = new Date(match.info.gameStartTimestamp).toISOString().slice(0, 13);
    activity.hours[hour] = (activity.hours[hour] ?? 0) + 1;
    added++;
    if (added % 50 === 0) console.log(`  ${added}게임 집계`);
  }

  // 파일이 너무 커지지 않게 항목별 상위 40개만 유지
  const now = new Date().toISOString();
  for (const t of TIERS) {
    const db = dbs[t];
    for (const c of Object.values(db.champs)) {
      for (const k of ["runes", "spells", "starters", "core", "boots", "skills"]) {
        c[k] = Object.fromEntries(Object.entries(c[k]).sort((a, b) => b[1][0] - a[1][0]).slice(0, 40));
      }
    }
    db.updatedAt = now;
    fs.mkdirSync(path.dirname(fileOf(t)), { recursive: true });
    fs.writeFileSync(fileOf(t), JSON.stringify(db));
  }
  fs.writeFileSync(seenFile, JSON.stringify([...seen].slice(-30000)));
  // 활동량은 최근 14일만 보관
  const cutoff = new Date(Date.now() - 14 * 24 * 3600_000).toISOString().slice(0, 13);
  activity.hours = Object.fromEntries(Object.entries(activity.hours).filter(([h]) => h >= cutoff).sort());
  activity.updatedAt = now;
  fs.writeFileSync(activityFile, JSON.stringify(activity));
  const dayCutoff = new Date(Date.now() + 9 * 3600_000 - 14 * 24 * 3600_000).toISOString().slice(0, 10);
  for (const [day, d] of Object.entries(daily.days)) {
    if (day < dayCutoff) delete daily.days[day];
    else for (const e of Object.values(d.champs)) e[2] = Object.fromEntries(Object.entries(e[2]).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10));
  }
  daily.days = Object.fromEntries(Object.entries(daily.days).sort());
  daily.updatedAt = now;
  fs.writeFileSync(dailyFile, JSON.stringify(daily));
  console.log(`완료: 서버 ${SERVER} 이번에 ${added}게임 추가 (${TIERS.map((t) => `${t} 누적 ${dbs[t].matches}`).join(", ")})`);
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
  const picks = [];
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
    picks.push({ key: `${p.championId}:${lane}`, win, core });
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
  return picks;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
