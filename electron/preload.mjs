import { contextBridge, ipcRenderer } from "electron";

const meta = await ipcRenderer.invoke("desktop:get-meta");

contextBridge.exposeInMainWorld("neonSnakeDesktop", {
  meta,
  exportSave: (payload) => ipcRenderer.invoke("desktop:export-save", payload),
  importSave: () => ipcRenderer.invoke("desktop:import-save"),
  openDataDirectory: () => ipcRenderer.invoke("desktop:open-data-directory")
});
