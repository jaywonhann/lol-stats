// 롤 클라이언트(LCU) 로컬 API로 챔피언 선택 상태를 읽습니다.
// 클라이언트가 켜져 있으면 LeagueClientUx.exe 실행 인자에서 포트와 토큰을 꺼내 127.0.0.1 로만 접속해요.
const { execFile } = require("node:child_process");
const https = require("node:https");

// 클라이언트 인증서는 자체 서명이라 127.0.0.1 접속에만 검증을 끕니다
const agent = new https.Agent({ rejectUnauthorized: false });

function findClient() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine",
      ],
      { windowsHide: true, timeout: 8000 },
      (err, out) => {
        if (err || !out) return resolve(null);
        const port = out.match(/--app-port=(\d+)/)?.[1];
        const token = out.match(/--remoting-auth-token=([\w-]+)/)?.[1];
        resolve(port && token ? { port, token } : null);
      },
    );
  });
}

function get(conn, path) {
  return new Promise((resolve) => {
    const req = https.get(
      {
        host: "127.0.0.1",
        port: conn.port,
        path,
        agent,
        timeout: 4000,
        headers: { Authorization: "Basic " + Buffer.from(`riot:${conn.token}`).toString("base64") },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve({ status: res.statusCode, data: null });
          try {
            resolve({ status: 200, data: JSON.parse(body) });
          } catch {
            resolve({ status: 200, data: null });
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => req.destroy());
  });
}

const LANE = { top: "top", jungle: "jungle", middle: "mid", bottom: "bottom", utility: "support" };
const SERVER = { KR: "kr", NA: "na1", EUW: "euw1" };

// onChange({ state: "noclient" | "idle" | "select", champ, lane, server })
function watch(onChange) {
  let conn = null;
  let last = "";
  const emit = (v) => {
    const key = JSON.stringify(v);
    if (key !== last) {
      last = key;
      onChange(v);
    }
  };
  let server = null;
  async function tick() {
    if (!conn) {
      conn = await findClient();
      if (!conn) emit({ state: "noclient" });
    }
    if (conn) {
      if (!server) {
        const r = await get(conn, "/riotclient/region-locale");
        server = SERVER[r?.data?.region] ?? null;
      }
      const res = await get(conn, "/lol-champ-select/v1/session");
      if (res === null) {
        // 클라이언트가 꺼졌어요
        conn = null;
        server = null;
        emit({ state: "noclient" });
      } else if (res.status !== 200 || !res.data) {
        emit({ state: "idle", server });
      } else {
        const s = res.data;
        const me = s.myTeam?.find((p) => p.cellId === s.localPlayerCellId);
        // 확정/선택 중인 챔피언, 없으면 미리 정해 둔 챔피언(픽 의도)
        let champ = me?.championId || me?.championPickIntent || 0;
        if (!champ)
          for (const group of s.actions ?? [])
            for (const a of group)
              if (a.actorCellId === s.localPlayerCellId && a.type === "pick" && a.championId) champ = a.championId;
        emit({ state: "select", champ: champ || null, lane: LANE[me?.assignedPosition] ?? null, server });
      }
    }
    setTimeout(tick, conn ? 1500 : 4000);
  }
  tick();
}

module.exports = { watch };
