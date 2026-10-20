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

// 클라이언트에 요청 (GET 외에 POST/PUT/PATCH/DELETE). 실패하면 null, 아니면 { status, data }
function request(conn, method, path, body) {
  return new Promise((resolve) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = https.request(
      {
        host: "127.0.0.1",
        port: conn.port,
        path,
        method,
        agent,
        timeout: 6000,
        headers: {
          Authorization: "Basic " + Buffer.from(`riot:${conn.token}`).toString("base64"),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {}
          resolve({ status: res.statusCode, data });
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => req.destroy());
    if (payload) req.write(payload);
    req.end();
  });
}

const LANE = { top: "top", jungle: "jungle", middle: "mid", bottom: "bottom", utility: "support" };
const SERVER = { KR: "kr", NA: "na1", EUW: "euw1" };

const api = { conn: () => null };

// onChange({ state: "noclient" | "idle" | "select" | "ingame", champ, lane, server })
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
  api.conn = () => conn;
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
        // 챔피언 선택이 아니면 게임 중인지 확인 (게임 중에도 같은 챔피언 빌드를 계속 보여줘요)
        const ph = await get(conn, "/lol-gameflow/v1/gameflow-phase");
        emit({ state: ph?.data === "InProgress" || ph?.data === "Reconnect" ? "ingame" : "idle", server });
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

// 룬 페이지 적용: 이름이 "livelol" 로 시작하는 내 페이지만 바꾸거나 지우고, 다른 페이지는 건드리지 않아요.
// page = { name, primaryStyleId, subStyleId, selectedPerkIds: 숫자 9개 }
async function applyRunes(page) {
  const conn = api.conn();
  if (!conn) return { ok: false, reason: "noclient" };
  if (
    !page ||
    !Number.isInteger(page.primaryStyleId) ||
    !Number.isInteger(page.subStyleId) ||
    !Array.isArray(page.selectedPerkIds) ||
    page.selectedPerkIds.length !== 9 ||
    !page.selectedPerkIds.every(Number.isInteger)
  )
    return { ok: false, reason: "invalid" };
  const list = await request(conn, "GET", "/lol-perks/v1/pages");
  if (!list || list.status !== 200 || !Array.isArray(list.data)) return { ok: false, reason: "error" };
  for (const p of list.data) {
    if (typeof p.name === "string" && p.name.startsWith("livelol") && p.isEditable !== false)
      await request(conn, "DELETE", `/lol-perks/v1/pages/${p.id}`);
  }
  const res = await request(conn, "POST", "/lol-perks/v1/pages", {
    name: `livelol ${String(page.name ?? "").slice(0, 20)}`.trim(),
    primaryStyleId: page.primaryStyleId,
    subStyleId: page.subStyleId,
    selectedPerkIds: page.selectedPerkIds,
    current: true,
  });
  if (res && res.status >= 200 && res.status < 300) return { ok: true };
  // 페이지 칸이 가득 찬 경우: 내 페이지가 아니면 지우지 않고 알려 줍니다
  return { ok: false, reason: "full" };
}

// 소환사 주문 적용 (챔피언 선택 중에만 가능)
async function applySpells(ids) {
  const conn = api.conn();
  if (!conn) return { ok: false, reason: "noclient" };
  if (!Array.isArray(ids) || ids.length !== 2 || !ids.every(Number.isInteger)) return { ok: false, reason: "invalid" };
  const res = await request(conn, "PATCH", "/lol-champ-select/v1/session/my-selection", { spell1Id: ids[0], spell2Id: ids[1] });
  if (res && res.status >= 200 && res.status < 300) return { ok: true };
  return { ok: false, reason: res?.status === 404 ? "notselect" : "error" };
}

module.exports = { watch, applyRunes, applySpells };
