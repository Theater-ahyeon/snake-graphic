import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: "#06111d",
    autoHideMenuBar: true,
    title: "Neon Snake Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl && !app.isPackaged) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return mainWindow;
  }

  void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  return mainWindow;
}

ipcMain.handle("desktop:get-meta", () => ({
  isDesktop: true,
  version: app.getVersion(),
  platform: process.platform,
  userDataPath: app.getPath("userData")
}));

ipcMain.handle("desktop:export-save", async (_event, payload) => {
  const suggestedName =
    typeof payload?.suggestedName === "string" && payload.suggestedName.trim().length > 0
      ? payload.suggestedName.trim()
      : "neon-snake-save.json";
  const content = typeof payload?.content === "string" ? payload.content : "";

  const result = await dialog.showSaveDialog({
    title: "导出 Neon Snake Studio 存档",
    defaultPath: path.join(app.getPath("documents"), suggestedName),
    filters: [{ name: "JSON Save", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, content, "utf8");
  return {
    canceled: false,
    filePath: result.filePath
  };
});

ipcMain.handle("desktop:import-save", async () => {
  const result = await dialog.showOpenDialog({
    title: "导入 Neon Snake Studio 存档",
    properties: ["openFile"],
    filters: [{ name: "JSON Save", extensions: ["json"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const [filePath] = result.filePaths;
  const content = await fs.readFile(filePath, "utf8");
  return {
    canceled: false,
    filePath,
    content
  };
});

ipcMain.handle("desktop:open-data-directory", async () => {
  const target = app.getPath("userData");
  const error = await shell.openPath(target);
  return {
    ok: error.length === 0,
    path: target,
    error
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
