// 사이트의 /__stats (서버가 켜진 뒤로 센 방문자 수)를 읽어 날짜별 기록(visits.json)에 합쳐요.
// 서버는 배포·재시작 때마다 0부터 다시 세서, 켜질 때마다 바뀌는 boot 값별로 마지막 숫자를 기억해 두고 더합니다.
// 결과: visits.json (날짜별 합계) 와 README.md (사람이 보는 표). visits.yml이 visits 브랜치에 올려요.
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.SITE ?? "https://livelol.onrender.com";
const OUT = process.env.OUT ?? "/tmp/visits";
const file = path.join(OUT, "visits.json");
const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { days: {} };

const res = await fetch(`${SITE}/__stats`, { headers: { "user-agent": "curl/visits-collector" }, signal: AbortSignal.timeout(60_000) });
if (!res.ok) {
  console.log(`stats ${res.status}`);
  process.exit(0);
}
const snap = await res.json();
for (const [day, d] of Object.entries(snap.days ?? {})) {
  const rec = (data.days[day] ??= { boots: {} });
  rec.boots ??= {};
  rec.boots[snap.boot] = { ...d, v: snap.v ?? 1 };
}

const addMap = (into, from) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v;
};
const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
const today = new Date().toISOString().slice(0, 10);
for (const [day, rec] of Object.entries(data.days)) {
  if (!rec.boots) continue;
  const t = { uv: 0, land: 0, nav: 0, ref: {}, top: {}, bots: {}, shares: {} };
  for (const b of Object.values(rec.boots)) {
    // 2026-11-10 이전 방식(v 없음)은 브라우저인 척하는 로봇까지 사람으로 셌어요. 그 기록은 로봇 쪽으로 옮겨요.
    if ((b.v ?? 1) < 2) {
      addMap(t.bots, { ...b.bots, other: (b.bots?.other ?? 0) + (b.land ?? 0) });
      addMap(t.shares, b.shares);
      continue;
    }
    t.uv += b.uv ?? 0;
    t.land += b.land ?? 0;
    t.nav += b.nav ?? 0;
    for (const k of ["ref", "top", "bots", "shares"]) addMap(t[k], b[k]);
  }
  Object.assign(rec, { uv: t.uv, land: t.land, nav: t.nav, ref: top(t.ref, 30), top: top(t.top, 30), bots: t.bots, shares: t.shares });
  // 사흘 지난 날은 서버가 더 보내지 않으니 합계만 남겨요
  if ((new Date(today) - new Date(day)) / 86_400_000 > 3) delete rec.boots;
}
data.updatedAt = new Date().toISOString();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(file, JSON.stringify(data));

const days = Object.keys(data.days).sort().reverse().slice(0, 30);
const fmt = (o, n) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "-";
const lines = [
  "# livelol.stats 방문 기록",
  "",
  "날짜는 UTC 기준이에요. 방문자 = 그날 서로 다른 사람 수(로봇 제외. 화면 스크립트까지 받아 간 접속만 사람으로 세요. 서버가 다시 켜지면 같은 사람이 한 번 더 세질 수 있어요).",
  "첫 접속 = 밖에서 들어온 횟수, 이동 = 사이트 안에서 페이지를 옮긴 횟수.",
  "",
  "| 날짜 | 방문자 | 첫 접속 | 이동 | 어디서 왔나 | 많이 본 페이지 | 검색 로봇 | 링크 공유 |",
  "|---|---:|---:|---:|---|---|---|---|",
  ...days.map((d) => {
    const r = data.days[d];
    return `| ${d} | ${r.uv ?? 0} | ${r.land ?? 0} | ${r.nav ?? 0} | ${fmt(r.ref, 5)} | ${fmt(r.top, 5)} | ${fmt(r.bots, 5)} | ${fmt(r.shares, 5)} |`;
  }),
  "",
  `마지막 갱신: ${data.updatedAt}`,
];
fs.writeFileSync(path.join(OUT, "README.md"), lines.join("\n") + "\n");
const t = data.days[today];
console.log(`${today} uv=${t?.uv ?? 0} land=${t?.land ?? 0} nav=${t?.nav ?? 0}`);
