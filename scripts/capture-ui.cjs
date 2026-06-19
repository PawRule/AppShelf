const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

async function capture() {
  const width = Number(process.env.CAPTURE_WIDTH ?? 1440);
  const height = Number(process.env.CAPTURE_HEIGHT ?? 900);

  const registry = {
    version: 0,
    settings: {
      language: "zh",
      viewMode: "cards",
      autoOpenBrowser: true,
      closeBehavior: "ask",
      scanFolders: []
    },
    apps: [
      {
        id: "sample-running",
        name: "Hello LocalApp",
        description: "Sample app for testing AppShelf launch and stop flows.",
        command: "node server.js",
        url: "http://localhost:4321",
        port: 4321,
        projectPath: "D:\\webAppStarter\\examples\\hello-localapp",
        manifestPath: "D:\\webAppStarter\\examples\\hello-localapp\\.localapp.json",
        workingDirectory: "D:\\webAppStarter\\examples\\hello-localapp",
        source: "manifest",
        status: "stopped"
      }
    ]
  };

  ipcMain.handle("registry:get", () => registry);
  ipcMain.handle("settings:update", (_event, patch) => {
    registry.settings = { ...registry.settings, ...patch };
    return registry;
  });
  ipcMain.handle("scan:run", () => registry);
  ipcMain.handle("dialog:selectFolder", () => undefined);
  ipcMain.handle("scan:addFolder", () => registry);
  ipcMain.handle("scan:removeFolder", () => registry);
  ipcMain.handle("app:createManual", () => registry);
  ipcMain.handle("app:update", (_event, input) => {
    registry.apps = registry.apps.map((appRecord) => (appRecord.id === input.id ? { ...appRecord, ...input } : appRecord));
    return registry;
  });
  ipcMain.handle("app:start", () => ({ ok: true }));
  ipcMain.handle("app:stop", () => registry);
  ipcMain.handle("app:openUrl", () => undefined);
  ipcMain.handle("app:openFolder", () => undefined);

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      preload: path.join(process.cwd(), "out", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadURL("http://localhost:5173");
  await new Promise((resolve) => setTimeout(resolve, 1200));

  if (process.env.CAPTURE_EDIT === "1") {
    await win.webContents.executeJavaScript(`
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent && button.textContent.includes("编辑配置"))
        ?.click();
    `);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const image = await win.capturePage();
  const outDir = path.join(process.cwd(), "docs", "design");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "current-renderer.png"), image.toPNG());

  app.quit();
}

app.whenReady().then(capture).catch((error) => {
  console.error(error);
  app.exit(1);
});
