const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("livelol", {
  onStatus: (fn) => ipcRenderer.on("status", (_e, s) => fn(s)),
  send: (cmd, arg) => ipcRenderer.send("cmd", cmd, arg),
});
