// 사이트(/app) 화면에서만 쓰는 연결. 룬·스펠 적용 두 가지만 열어 둡니다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("livelolApp", {
  applyRunes: (page) => ipcRenderer.invoke("apply-runes", page),
  applySpells: (ids) => ipcRenderer.invoke("apply-spells", ids),
});
