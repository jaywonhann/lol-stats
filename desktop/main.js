// livelol.stats 윈도우 앱: 위쪽은 상태 표시줄(toolbar.html), 아래는 사이트의 /app 화면.
// 챔피언 선택에서 고르거나 확정한 챔피언이 바뀌면 그 챔피언·라인 빌드 화면으로 바꿔 줍니다.
const { app, BrowserWindow, WebContentsView, ipcMain, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { watch, applyRunes, applySpells } = require("./lcu");

const SITE = "https://lollive.vercel.app";
const BAR = 44;
// 앱에서는 사이트 상단 메뉴와 하단 문구를 숨겨 빌드만 보이게 합니다
const CSS = "header, footer, .mock-banner { display: none !important; } main { padding-top: 12px !important; }";

let win, view;
let current = { champ: null, lane: null };
let auto = true; // 챔피언을 확정하면 추천 룬·스펠을 자동으로 넣기 (toolbar 의 ⚡ 로 켜고 끔)
let note = null; // 마지막 자동 적용 결과
let lastAuto = null;
const prefsFile = () => path.join(app.getPath("userData"), "prefs.json");
function loadPrefs() {
  try {
    const p = JSON.parse(fs.readFileSync(prefsFile(), "utf8"));
    if (typeof p.auto === "boolean") auto = p.auto;
  } catch {}
}
function savePrefs() {
  try {
    fs.writeFileSync(prefsFile(), JSON.stringify({ auto }));
  } catch {}
}
let lang = app.getLocale().startsWith("ko") ? "ko" : "en";

async function setCookie(name, value) {
  await session.defaultSession.cookies.set({ url: SITE, name, value, expirationDate: Date.now() / 1000 + 365 * 86400 });
}

function layout() {
  const [w, h] = win.getContentSize();
  view.setBounds({ x: 0, y: BAR, width: w, height: h - BAR });
}

function open(champ, lane) {
  const q = champ ? `?champ=${champ}${lane ? `&lane=${lane}` : ""}` : "";
  view.webContents.loadURL(`${SITE}/app${q}`);
}

function status(s) {
  win?.webContents.send("status", { ...s, lang, pinned: win.isAlwaysOnTop(), auto, note });
}

// 확정한 챔피언의 추천 룬·스펠을 사이트에서 받아 클라이언트에 넣어요
async function autoApply(s) {
  try {
    const q = new URLSearchParams({ champ: String(s.champ), lane: s.lane ?? "", server: s.server ?? "kr", lang });
    const res = await fetch(`${SITE}/api/app-build?${q}`);
    const b = res.ok ? await res.json() : null;
    if (!b?.ok) {
      note = b?.reason === "no-data" ? "nodata" : "autofail";
    } else {
      const r = b.runes ? await applyRunes(b.runes) : { ok: false };
      const sp = b.spells ? await applySpells(b.spells) : { ok: false };
      note = r.ok && sp.ok ? "done" : r.ok ? "runes" : sp.ok ? "spells" : r.reason === "full" ? "full" : "autofail";
    }
  } catch {
    note = "autofail";
  }
  status(last);
}

let last = { state: "noclient" };
app.whenReady().then(async () => {
  loadPrefs();
  await setCookie("lang", lang);
  win = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 400,
    minHeight: 500,
    title: "livelol.stats",
    backgroundColor: "#0b0f19",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  win.setMenu(null);
  win.loadFile("toolbar.html");
  view = new WebContentsView({ webPreferences: { preload: path.join(__dirname, "view-preload.js") } });
  win.contentView.addChildView(view);
  layout();
  win.on("resize", layout);
  view.webContents.on("did-finish-load", () => view.webContents.insertCSS(CSS));
  // 사이트 밖 링크(유튜브 등)는 기본 브라우저로
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  view.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(SITE)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  open(null);

  win.webContents.on("did-finish-load", () => status(last));
  watch(async (s) => {
    last = s;
    if (s.server) await setCookie("server", s.server);
    status(s);
    // 챔피언을 확정한 순간 한 번만 자동 적용 (챔피언 선택이 끝나면 다음 판을 위해 초기화)
    if (s.state !== "select") {
      lastAuto = null;
      note = null;
    } else if (auto && s.locked && s.champ) {
      const key = `${s.champ}:${s.lane}`;
      if (key !== lastAuto) {
        lastAuto = key;
        note = "working";
        autoApply(s);
      }
    }
    if (s.state === "select" && s.champ && (s.champ !== current.champ || s.lane !== current.lane)) {
      current = { champ: s.champ, lane: s.lane };
      open(s.champ, s.lane);
    }
  });

  // 사이트 화면의 룬·스펠 적용 버튼. 우리 사이트 주소에서 온 요청만 받아요.
  const fromSite = (e) => e.senderFrame?.url?.startsWith(SITE);
  ipcMain.handle("apply-runes", (e, page) => (fromSite(e) ? applyRunes(page) : { ok: false, reason: "denied" }));
  ipcMain.handle("apply-spells", (e, ids) => (fromSite(e) ? applySpells(ids) : { ok: false, reason: "denied" }));

  ipcMain.on("cmd", async (_e, cmd) => {
    if (cmd === "home") {
      current = { champ: null, lane: null };
      open(null);
    } else if (cmd === "reload") view.webContents.reload();
    else if (cmd === "back" && view.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
    else if (cmd === "auto") {
      auto = !auto;
      savePrefs();
      if (auto) lastAuto = null; // 켜는 순간 이미 확정한 챔피언이 있으면 바로 적용
    } else if (cmd === "pin") win.setAlwaysOnTop(!win.isAlwaysOnTop(), "screen-saver");
    else if (cmd === "lang") {
      lang = lang === "ko" ? "en" : "ko";
      await setCookie("lang", lang);
      view.webContents.reload();
    }
    status(last);
  });
});

app.on("window-all-closed", () => app.quit());
