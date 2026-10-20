// livelol.stats 윈도우 앱: 위쪽은 상태 표시줄(toolbar.html), 아래는 사이트의 /app 화면.
// 챔피언 선택에서 고르거나 확정한 챔피언이 바뀌면 그 챔피언·라인 빌드 화면으로 바꿔 줍니다.
const { app, BrowserWindow, WebContentsView, ipcMain, shell, session } = require("electron");
const path = require("node:path");
const { watch } = require("./lcu");

const SITE = "https://lollive.vercel.app";
const BAR = 44;
// 앱에서는 사이트 상단 메뉴와 하단 문구를 숨겨 빌드만 보이게 합니다
const CSS = "header, footer, .mock-banner { display: none !important; } main { padding-top: 12px !important; }";

let win, view;
let current = { champ: null, lane: null };
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
  win?.webContents.send("status", { ...s, lang, pinned: win.isAlwaysOnTop() });
}

app.whenReady().then(async () => {
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
  view = new WebContentsView();
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

  let last = { state: "noclient" };
  win.webContents.on("did-finish-load", () => status(last));
  watch(async (s) => {
    last = s;
    if (s.server) await setCookie("server", s.server);
    status(s);
    if (s.state === "select" && s.champ && (s.champ !== current.champ || s.lane !== current.lane)) {
      current = { champ: s.champ, lane: s.lane };
      open(s.champ, s.lane);
    }
  });

  ipcMain.on("cmd", async (_e, cmd) => {
    if (cmd === "home") {
      current = { champ: null, lane: null };
      open(null);
    } else if (cmd === "reload") view.webContents.reload();
    else if (cmd === "back" && view.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
    else if (cmd === "pin") win.setAlwaysOnTop(!win.isAlwaysOnTop(), "screen-saver");
    else if (cmd === "lang") {
      lang = lang === "ko" ? "en" : "ko";
      await setCookie("lang", lang);
      view.webContents.reload();
    }
    status(last);
  });
});

app.on("window-all-closed", () => app.quit());
