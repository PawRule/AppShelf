const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const captureUserData = path.join(process.cwd(), ".tmp", "electron-capture");
fs.mkdirSync(captureUserData, { recursive: true });
app.setPath("userData", captureUserData);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-http-cache");

function contentTypeFor(filePath) {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css";
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function startRendererServer() {
  const rendererRoot = path.join(process.cwd(), "out", "renderer");
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const relativePath = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
    const filePath = path.resolve(rendererRoot, relativePath);

    if (!filePath.startsWith(rendererRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      response.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function capture() {
  const width = Number(process.env.CAPTURE_WIDTH ?? 1440);
  const height = Number(process.env.CAPTURE_HEIGHT ?? 900);
  const language = process.env.CAPTURE_LANGUAGE === "zh" ? "zh" : "en";
  const theme = process.env.CAPTURE_THEME === "dark" ? "dark" : "light";
  const outFile = process.env.CAPTURE_OUT ?? "docs/images/appshelf-main.png";
  const sampleProjectPath = process.env.CAPTURE_SAMPLE_PATH ?? "C:\\Projects\\hello-localapp";
  const docsProjectPath = process.env.CAPTURE_DOCS_PATH ?? "C:\\Projects\\local-docs";

  const registry = {
    version: 0,
    settings: {
      language,
      theme,
      viewMode: "cards",
      sortMode: "added",
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
        projectPath: sampleProjectPath,
        manifestPath: path.join(sampleProjectPath, ".localapp.json"),
        workingDirectory: sampleProjectPath,
        source: "manifest",
        status: "stopped"
      },
      {
        id: "sample-docs",
        name: "Local Docs",
        description: "Sample documentation site managed through AppShelf.",
        command: "npm run docs",
        url: "http://localhost:5173",
        port: 5173,
        projectPath: docsProjectPath,
        manifestPath: path.join(docsProjectPath, ".localapp.json"),
        workingDirectory: docsProjectPath,
        source: "manual",
        status: "running",
        processId: 4210
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
      nodeIntegration: false,
      sandbox: false
    }
  });

  const { server, url } = await startRendererServer();
  await win.loadURL(url);
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
  const resolvedOutFile = path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile);
  const outDir = path.dirname(resolvedOutFile);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(resolvedOutFile, image.toPNG());

  server.close();
  app.quit();
}

app.whenReady().then(capture).catch((error) => {
  console.error(error);
  app.exit(1);
});
