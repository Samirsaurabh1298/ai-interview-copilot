import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { getCaptureSources, captureSourceImage } from "./capture.js";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "AI Coding Interview Copilot",
    backgroundColor: "#090d16",
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isDev = process.env.NODE_ENV === "development";
  const devUrl = process.env.VITE_DEV_SERVER_URL;

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Main] Window content loaded successfully");
    mainWindow?.setTitle("AI Coding Interview Copilot");
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error(`[Main] Failed to load url: ${url} (code ${code}, desc: ${desc})`);
  });

  if (isDev && devUrl) {
    console.log(`[Main] Loading dev server: ${devUrl}`);
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, "../../dist/index.html");
    console.log(`[Main] Loading window file: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("[Main] Error during loadFile:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("capture:get-sources", async () => {
  return await getCaptureSources();
});

ipcMain.handle("capture:source-image", async (_event, sourceId: string) => {
  return await captureSourceImage(sourceId);
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

