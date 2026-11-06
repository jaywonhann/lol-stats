// 전적 검색 "내 업적": 최근 솔로랭크 경기 기록(Riot)만으로 배지, 최고의 한 판, 같이 게임한 사람들 사이 순위를 계산합니다.
import type { Match, Participant } from "./riot";
import type { Lang } from "./i18n";

type T = Record<Lang, string>;
export type Badge = { id: string; icon: string; name: T; how: T; have: number; need: number };

const kdaOf = (p: Participant) => (p.kills + p.assists) / Math.max(1, p.deaths);
const csOf = (p: Participant, min: number) => (p.totalMinionsKilled + p.neutralMinionsKilled) / min;

type G = { m: Match; me: Participant; team: Participant[]; min: number };
function mine(matches: Match[], puuid: string): G[] {
  const out: G[] = [];
  for (const m of matches) {
    const me = m.info.participants.find((p) => p.puuid === puuid);
    if (!me || m.info.gameDuration < 300) continue;
    out.push({ m, me, team: m.info.participants.filter((p) => p.teamId === me.teamId), min: m.info.gameDuration / 60 });
  }
  return out; // 최신 → 오래된 순 (받은 순서 그대로)
}

export function badges(matches: Match[], puuid: string): Badge[] {
  const gs = mine(matches, puuid);
  const count = (f: (g: G) => boolean) => gs.filter(f).length;
  const sum = (f: (g: G) => number) => gs.reduce((s, g) => s + f(g), 0);
  let best = 0;
  let run = 0;
  for (const g of [...gs].reverse()) {
    run = g.me.win ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const top = (g: G, f: (p: Participant) => number) => f(g.me) > 0 && g.team.every((p) => p === g.me || f(p) < f(g.me));
  const b = (id: string, icon: string, name: T, how: T, have: number, need: number): Badge => ({ id, icon, name, how, have: Math.min(have, need), need });
  return [
    b("penta", "🏆", { ko: "펜타킬", en: "Pentakill" }, { ko: "한 판에 혼자 5명 처치", en: "Kill all 5 enemies in one fight" }, sum((g) => g.me.pentaKills ?? 0), 1),
    b("quadra", "💥", { ko: "쿼드라킬", en: "Quadrakill" }, { ko: "한 번에 4명 처치", en: "Kill 4 enemies in a row" }, sum((g) => (g.me.quadraKills ?? 0) + (g.me.pentaKills ?? 0)), 1),
    b("streak5", "🔥", { ko: "5연승", en: "5-win streak" }, { ko: "솔로랭크 5판 연속 승리", en: "Win 5 solo queue games in a row" }, best, 5),
    b("streak3", "⚡", { ko: "3연승", en: "3-win streak" }, { ko: "솔로랭크 3판 연속 승리", en: "Win 3 solo queue games in a row" }, best, 3),
    b("perfect", "🛡️", { ko: "무데스 승리", en: "Deathless win" }, { ko: "한 번도 안 죽고 이기기", en: "Win without dying once" }, count((g) => g.me.win && g.me.deaths === 0), 1),
    b("kda10", "🎯", { ko: "KDA 10", en: "KDA 10" }, { ko: "한 판 KDA 10 이상", en: "A game with KDA 10+" }, count((g) => kdaOf(g.me) >= 10), 1),
    b("carry", "⚔️", { ko: "딜량 1등 5번", en: "Top damage ×5" }, { ko: "팀에서 챔피언 딜량 1등 5판", en: "Top team damage in 5 games" }, count((g) => top(g, (p) => p.totalDamageDealtToChampions)), 5),
    b("vision", "👁️", { ko: "시야왕", en: "Vision king" }, { ko: "팀에서 시야 점수 1등 5판", en: "Top team vision score in 5 games" }, count((g) => top(g, (p) => p.visionScore)), 5),
    b("solo", "🗡️", { ko: "솔로킬 장인", en: "Solo kill artist" }, { ko: "솔로킬 10번", en: "10 solo kills" }, sum((g) => g.me.challenges?.soloKills ?? 0), 10),
    b("fb", "🩸", { ko: "퍼블 사냥꾼", en: "First blood hunter" }, { ko: "퍼스트 블러드 3번", en: "Get first blood 3 times" }, count((g) => !!g.me.firstBloodKill), 3),
    b("spree", "👑", { ko: "전설의 연속킬", en: "Legendary spree" }, { ko: "안 죽고 8명 연속 처치", en: "8 kills in a row without dying" }, Math.max(0, ...gs.map((g) => g.me.largestKillingSpree ?? 0)), 8),
    b("cs10", "🌾", { ko: "분당 CS 10", en: "10 CS/min" }, { ko: "한 판 분당 CS 10 이상", en: "A game with 10+ CS per minute" }, count((g) => csOf(g.me, g.min) >= 10), 1),
  ];
}

export type BestGame = {
  id: string; win: boolean; championName: string; kills: number; deaths: number; assists: number;
  kda: number; dmg: number; dmgShare: number; cs: number; at: number; minutes: number;
};
export function bestGame(matches: Match[], puuid: string): BestGame | null {
  const gs = mine(matches, puuid);
  if (gs.length === 0) return null;
  const share = (g: G) => g.me.totalDamageDealtToChampions / Math.max(1, g.team.reduce((s, p) => s + p.totalDamageDealtToChampions, 0));
  const score = (g: G) => Math.min(kdaOf(g.me), 12) + (g.me.win ? 3 : 0) + share(g) * 12;
  const g = gs.reduce((a, b) => (score(b) > score(a) ? b : a));
  return {
    id: g.m.metadata.matchId, win: g.me.win, championName: g.me.championName,
    kills: g.me.kills, deaths: g.me.deaths, assists: g.me.assists, kda: kdaOf(g.me),
    dmg: g.me.totalDamageDealtToChampions, dmgShare: share(g), cs: csOf(g.me, g.min),
    at: g.m.info.gameEndTimestamp ?? g.m.info.gameCreation, minutes: g.min,
  };
}

// 같이 게임한 플레이어(최근 경기의 다른 9명)와 비교한 순위: "상위 N%"
export type Rank = { id: "dmg" | "cs" | "kp" | "kda"; mine: number; top: number; of: number };
export function rankVsLobby(matches: Match[], puuid: string): Rank[] {
  const gs = mine(matches, puuid);
  if (gs.length < 5) return [];
  const metric = {
    dmg: (p: Participant, g: G) => p.totalDamageDealtToChampions / g.min,
    cs: (p: Participant, g: G) => csOf(p, g.min),
    kp: (p: Participant, g: G) => {
      const tk = g.m.info.participants.filter((x) => x.teamId === p.teamId).reduce((s, x) => s + x.kills, 0);
      return tk ? (p.kills + p.assists) / tk : 0;
    },
    kda: (p: Participant) => kdaOf(p),
  };
  return (Object.keys(metric) as Rank["id"][]).map((id) => {
    const f = metric[id];
    const others: number[] = [];
    let me = 0;
    for (const g of gs) {
      me += f(g.me, g);
      for (const p of g.m.info.participants) if (p.puuid !== puuid) others.push(f(p, g));
    }
    me /= gs.length;
    const better = others.filter((v) => v > me).length + 0.5 * others.filter((v) => v === me).length;
    return { id, mine: me, top: Math.max(1, Math.round(((better + 1) / (others.length + 1)) * 100)), of: others.length };
  });
}
