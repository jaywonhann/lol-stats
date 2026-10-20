// 프로 선수·유명인(data/pros.json)과 서버별 챌린저 상위 랭커가 최근 솔로랭크에서 실제로 간 빌드를 모읍니다.
// GitHub Actions(pro-builds.yml)에서 실행되고, 결과는 pro-data 브랜치의 builds.json 에 올라가요.
// 윈도우 앱과 사이트의 /app 화면이 이 파일을 읽어요.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const KEY = (process.env.RIOT_API_KEY ?? "").match(/RGAPI-[0-9a-f-]{36}/i)?.[0] ?? process.env.RIOT_API_KEY?.trim();
const OUT = process.env.OUT ?? "pro-data";
const TOP = Number(process.env.TOP ?? 10); // 서버별 챌린저 상위 몇 명
const PER = Number(process.env.PER ?? 4); // 한 사람당 최근 몇 게임
const KEEP_MS = 5 * 24 * 3_600_000;
const MAX_KEEP = 1500;
const SERVERS = { kr: "asia", na1: "americas", euw1: "europe" };
const SERVER_NAME = { kr: "KR", na1: "NA", euw1: "EUW" };
const LANE = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "bottom", UTILITY: "support" };
const DDRAGON = "https://ddragon.leagueoflegends.com";
if (!KEY) {
  console.log("::warning::RIOT_API_KEY 가 없어서 건너뜁니다.");
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function riot(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { "X-Riot-Token": KEY } });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 10) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      console.log("::warning::Riot API 키가 거절됐어요. 키를 새로 넣으면 다음 실행부터 다시 모아요.");
      process.exit(0);
    }
    await sleep(150);
    return res.ok ? res.json() : null;
  }
  return null;
}

const file = `${OUT}/builds.json`;
const db = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { builds: [], names: {} };
db.names ??= {};
const seen = new Set(db.builds.map((b) => b.m));

const versions = await (await fetch(`${DDRAGON}/api/versions.json`)).json();
const itemData = (await (await fetch(`${DDRAGON}/cdn/${versions[0]}/data/en_US/item.json`)).json()).data;
const isBoots = (id) => itemData[id]?.tags?.includes("Boots") && (itemData[id]?.depth ?? 1) >= 2;
const isTrinket = (id) => itemData[id]?.tags?.includes("Trinket") ?? false;
const isCore = (id) => {
  const it = itemData[id];
  if (!it || isBoots(id) || it.tags?.includes("Consumable") || it.tags?.includes("Trinket")) return false;
  return !it.into?.length && (it.gold?.total ?? 0) >= 2000;
};

// 누구를 볼지: pros.json + 서버별 챌린저 상위 랭커
const people = [];
try {
  const pros = JSON.parse(readFileSync("data/pros.json", "utf8"));
  for (const p of pros) {
    if (!SERVERS[p.server]) continue;
    const [name, tag] = p.riotId.split("#");
    const acc = await riot(`https://${SERVERS[p.server]}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    if (!acc) {
      console.log(`::warning::${p.riotId} 계정을 찾지 못했어요`);
      continue;
    }
    people.push({ puuid: acc.puuid, server: p.server, who: p.riotId, label: p.label, kind: p.kind ?? "pro" });
  }
} catch {
  console.log("::warning::data/pros.json 을 읽지 못했어요");
}
for (const server of Object.keys(SERVERS)) {
  const league = await riot(`https://${server}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`);
  const top = (league?.entries ?? []).filter((e) => e.puuid).sort((a, b) => b.leaguePoints - a.leaguePoints).slice(0, TOP);
  for (const [i, e] of top.entries()) {
    if (people.some((p) => p.puuid === e.puuid)) continue;
    if (!db.names[e.puuid]) {
      const acc = await riot(`https://${SERVERS[server]}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${e.puuid}`);
      if (acc?.gameName) db.names[e.puuid] = `${acc.gameName}#${acc.tagLine}`;
    }
    people.push({ puuid: e.puuid, server, who: db.names[e.puuid] ?? "", label: `${SERVER_NAME[server]} Challenger #${i + 1}`, lp: e.leaguePoints, kind: "challenger" });
  }
}
console.log(`${people.length}명 확인`);

let added = 0;
for (const p of people) {
  const region = SERVERS[p.server];
  const ids = (await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${p.puuid}/ids?queue=420&count=${PER}`)) ?? [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const match = await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`);
    const me = match?.info?.participants?.find((x) => x.puuid === p.puuid);
    if (!me || match.info.gameDuration < 600) continue;
    const timeline = await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}/timeline`);
    const buys = [];
    for (const f of timeline?.info?.frames ?? [])
      for (const e of f.events) {
        if (e.participantId !== me.participantId) continue;
        if (e.type === "ITEM_PURCHASED") buys.push({ t: e.timestamp, id: String(e.itemId) });
        if (e.type === "ITEM_UNDO") {
          const i = buys.findLastIndex((x) => x.id === String(e.beforeId));
          if (i >= 0) buys.splice(i, 1);
        }
      }
    const finalItems = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5].map(String).filter((x) => x !== "0");
    // 타임라인이 없으면 마지막 인벤토리로 대신합니다
    const core = buys.length ? [...new Set(buys.filter((x) => isCore(x.id)).map((x) => x.id))].slice(0, 6) : finalItems.filter(isCore);
    const boots = (buys.find((x) => isBoots(x.id)) ?? { id: finalItems.find(isBoots) })?.id ?? null;
    const start = buys.filter((x) => x.t < 60_000 && !isTrinket(x.id)).map((x) => x.id);
    const [pri, sec] = me.perks.styles;
    db.builds.push({
      m: id,
      s: p.server,
      who: p.who,
      label: p.label,
      kind: p.kind,
      champ: me.championId,
      lane: LANE[me.teamPosition] ?? null,
      win: me.win,
      kda: [me.kills, me.deaths, me.assists],
      at: match.info.gameEndTimestamp ?? match.info.gameCreation,
      dur: match.info.gameDuration,
      core,
      boots,
      start,
      runes: { pri: pri.style, sec: sec.style, perks: [...pri.selections, ...sec.selections].map((s) => s.perk) },
      spells: [me.summoner1Id, me.summoner2Id],
    });
    added++;
  }
}

const cut = Date.now() - KEEP_MS;
db.builds = db.builds.filter((b) => b.at >= cut).sort((a, b) => b.at - a.at).slice(0, MAX_KEEP);
db.updatedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(db));
console.log(`새 게임 ${added}개, 총 ${db.builds.length}개`);
