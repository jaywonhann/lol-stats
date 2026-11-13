// 빌드 전에 세 서버를 다 열어야 하는 합계(상성·듀오)를 data/derived/ 에 미리 계산해 둡니다.
// 무료 서버(Render 512MB)가 요청마다 세 서버 데이터를 한꺼번에 읽지 않게 하려는 거예요.
import fs from "node:fs";
import path from "node:path";
import { computeDuoPairs, DERIVED, loadRealData, slimPatch } from "../src/lib/real";
import { computeTopMatchups } from "../src/lib/matchups";
import { RANKS, SERVERS } from "../src/lib/lanes";
import { computeSiteAvg } from "../src/lib/summoner";

// 예전 결과가 남아 있으면 원본 대신 그걸 읽게 되니 먼저 지워요
fs.rmSync(DERIVED, { recursive: true, force: true });
fs.mkdirSync(DERIVED, { recursive: true });
const write = (name: string, v: unknown) => {
  fs.writeFileSync(path.join(DERIVED, `${name}.json`), JSON.stringify(v));
  console.log(`derived/${name}.json`);
};
const servers = SERVERS.map((s) => s.id);
write("top-matchups-10", computeTopMatchups(10));
for (const r of RANKS) write(`duo-${r.id}-${servers.join("-")}`, computeDuoPairs(r.id, servers));
// 서버·랭크별로 패치 파일을 미리 합치고, 표본이 적은 기록을 빼서 작게 저장 (위 합계를 다 계산한 다음에 써야 원본을 읽어요)
for (const s of servers)
  for (const r of RANKS) write(`real-${s}-${r.id}`, [...loadRealData({ server: s, rank: r.id }).values()].map((d) => slimPatch(d)));
// 전적 검색에서 쓰는 챔피언+라인 평균 승률 (몇 KB)
for (const s of servers) write(`avg-${s}`, computeSiteAvg(s));
