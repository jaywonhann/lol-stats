// 로딩 화면 승률 예측: 우리 집계(챔피언·라인 승률, 라인 맞상대 승률)로 만든 단순 추정이에요.
// 실제 결과로 보정한 모델이 아니라, 챔피언 조합이 얼마나 유리한지 대략 보여주는 용도입니다.
import type { ChampAgg, PatchData } from "./real";
import { MIN_CHAMP_GAMES } from "./real";
import type { Lane } from "./lanes";

export const PREDICT_LANES: Lane[] = ["top", "jungle", "mid", "bottom", "support"];

const logit = (p: number) => Math.log(p / (1 - p));
const PRIOR = 20; // 표본이 적으면 50%쪽으로 당김

function strength(c: ChampAgg | undefined) {
  if (!c || c.games < MIN_CHAMP_GAMES) return null;
  return logit((c.wins + PRIOR / 2) / (c.games + PRIOR));
}

export type LaneEdge = { lane: Lane; edge: number; source: "matchup" | "winrate" | "none"; games: number };

// 한 라인에서 A 챔피언이 B 챔피언보다 얼마나 유리한지 (로짓 단위, 양수면 A 유리)
export function laneEdge(data: PatchData, lane: Lane, a: string, b: string): LaneEdge {
  const ca = data.champs[`${a}:${lane}`];
  const cb = data.champs[`${b}:${lane}`];
  const direct = ca?.vs[b];
  if (ca && direct && direct[0] >= 8) {
    const base = strength(ca) ?? 0;
    // 맞상대 승률을 이 챔피언의 평균 쪽으로 당겨서 사용
    const p = (direct[1] + 10 * (1 / (1 + Math.exp(-base)))) / (direct[0] + 10);
    return { lane, edge: logit(Math.min(0.95, Math.max(0.05, p))), source: "matchup", games: direct[0] };
  }
  const sa = strength(ca);
  const sb = strength(cb);
  if (sa === null && sb === null) return { lane, edge: 0, source: "none", games: 0 };
  return { lane, edge: (sa ?? 0) - (sb ?? 0), source: "winrate", games: Math.min(ca?.games ?? 0, cb?.games ?? 0) };
}

export function predict(data: PatchData, blue: string[], red: string[]) {
  const edges = PREDICT_LANES.map((lane, i) => laneEdge(data, lane, blue[i], red[i]));
  const sum = edges.reduce((s, e) => s + e.edge, 0);
  // 한 라인 우위가 팀 전체 결과에 미치는 영향은 작아서 0.6을 곱하고, 30~70%로 제한
  const p = 1 / (1 + Math.exp(-0.6 * sum));
  return { blue: Math.min(0.7, Math.max(0.3, p)), edges };
}
