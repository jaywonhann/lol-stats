// 빌드 전에 세 서버를 다 열어야 하는 합계(상성·듀오)를 data/derived/ 에 미리 계산해 둡니다.
// 무료 서버(Render 512MB)가 요청마다 세 서버 데이터를 한꺼번에 읽지 않게 하려는 거예요.
import fs from "node:fs";
import path from "node:path";
import { computeDuoPairs, DERIVED } from "../src/lib/real";
import { computeTopMatchups } from "../src/lib/matchups";
import { RANKS, SERVERS } from "../src/lib/lanes";

fs.mkdirSync(DERIVED, { recursive: true });
const write = (name: string, v: unknown) => {
  fs.writeFileSync(path.join(DERIVED, `${name}.json`), JSON.stringify(v));
  console.log(`derived/${name}.json`);
};
const servers = SERVERS.map((s) => s.id);
write("top-matchups-10", computeTopMatchups(10));
for (const r of RANKS) write(`duo-${r.id}-${servers.join("-")}`, computeDuoPairs(r.id, servers));
