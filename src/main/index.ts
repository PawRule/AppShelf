import { app, BrowserWindow, dialog, ipcMain, shell, Tray, Menu, nativeImage, protocol } from "electron";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type {
  AppConfigInput,
  AppRecord,
  AppStatusUpdate,
  LogEntry,
  ManualAppInput,
  StartResult,
  UserRegistry,
  UserSettings
} from "../shared/types";
import {
  applyScanResult as applyLibraryScanResult,
  findDuplicateAppForProject,
  findRemovedManifestForProject,
  findApp as findLibraryApp,
  removeAppFromLibrary,
  removeAppsFromScanFolder,
  restoreHiddenManifest as restoreLibraryHiddenManifest,
  updateApp as updateLibraryApp
} from "./appLibrary";
import { waitForUrl } from "./health";
import { createManualApp, scanFolders, updateAppConfig } from "./manifest";
import { ProcessManager } from "./processManager";
import { loadRegistry, saveRegistry } from "./store";
import { commandHash } from "./utils";

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let registry: UserRegistry;

app.setName("AppShelf");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "appshelf-icon",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

const appIconPath = join(__dirname, "../../assets/app-icon/appshelf-icon-window.png");
const trayIconPath = join(__dirname, "../../assets/app-icon/appshelf-icon-tray.png");
const allowedIconMimeTypes = new Map([
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);
const maxIconBytes = 5 * 1024 * 1024;

function sendToRenderer(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

const processManager = new ProcessManager(
  (entry: LogEntry) => sendToRenderer("app:log", entry),
  (appId, status, details) => {
    const payload: AppStatusUpdate = {
      appId,
      status,
      errorSummary: details?.errorSummary,
      processId: details?.processId,
      externalProcessIds: details?.externalProcessIds
    };

    updateApp(appId, {
      status,
      lastErrorSummary: details?.errorSummary,
      processId: details?.processId,
      externalProcessIds: details?.externalProcessIds
    });
    sendToRenderer("app:status", payload);
  }
);

async function startAppById(appId: string, trustCommand = false): Promise<StartResult> {
  const appRecord = findApp(appId);
  if (!appRecord) return { ok: false, error: "App not found." };

  const hash = commandHash(appRecord.command);
  if (appRecord.trustedCommandHash !== hash && !trustCommand) {
    return {
      ok: false,
      needsTrust: true,
      appId: appRecord.id,
      appName: appRecord.name,
      command: appRecord.command,
      workingDirectory: appRecord.workingDirectory,
      manifestPath: appRecord.manifestPath,
      source: appRecord.source
    };
  }

  if (trustCommand) {
    updateApp(appId, { trustedCommandHash: hash });
  }

  const urlToCheck = appRecord.url ?? (appRecord.port ? `http://localhost:${appRecord.port}` : undefined);

  if (urlToCheck) {
    const alreadyReachable = await waitForUrl(urlToCheck, 1000);
    if (alreadyReachable) {
      const pids = appRecord.port ? await processManager.findListeningPids(appRecord.port) : [];
      const line =
        pids.length > 0
          ? `URL is already reachable: ${urlToCheck}. Treating app as externally running on PID ${pids.join(", ")}.`
          : `URL is already reachable: ${urlToCheck}. Treating app as externally running without starting a duplicate process.`;
      sendToRenderer("app:log", { appId, stream: "system", line, timestamp: Date.now() });
      updateApp(appId, {
        status: "external",
        lastErrorSummary: undefined,
        processId: undefined,
        externalProcessIds: pids
      });
      sendToRenderer("app:status", { appId, status: "external", externalProcessIds: pids });

      if (registry.settings.autoOpenBrowser) {
        await shell.openExternal(urlToCheck);
      }

      return { ok: true };
    }
  }

  const started = await processManager.start(appRecord);
  if (!started) {
    return { ok: false, error: findApp(appId)?.lastErrorSummary ?? "App did not start. Check logs for details." };
  }

  if (urlToCheck) {
    const reachable = await waitForUrl(urlToCheck);
    if (reachable) {
      updateApp(appId, { status: "running", lastErrorSummary: undefined });
      sendToRenderer("app:status", { appId, status: "running" });
      if (registry.settings.autoOpenBrowser) {
        await shell.openExternal(urlToCheck);
      }
    } else if (processManager.isRunning(appId)) {
      const summary = `The process is running, but ${urlToCheck} did not respond before timeout.`;
      updateApp(appId, { status: "unreachable", lastErrorSummary: summary });
      sendToRenderer("app:status", { appId, status: "unreachable", errorSummary: summary });
    }
  } else {
    updateApp(appId, { status: "running" });
    sendToRenderer("app:status", { appId, status: "running" });
  }

  return { ok: true };
}

function findApp(appId: string): AppRecord | undefined {
  return findLibraryApp(registry, appId);
}

function updateApp(appId: string, patch: Partial<AppRecord>): void {
  registry = updateLibraryApp(registry, appId, patch);
  saveRegistry(registry);
}

function applyScanResult(scanResult: Awaited<ReturnType<typeof scanFolders>>): void {
  registry = applyLibraryScanResult(registry, scanResult, {
    isProcessRunning: (appId) => processManager.isRunning(appId)
  });
  saveRegistry(registry);
}

function normalizedIconPath(filePath: string): string {
  const normalized = resolve(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isRegisteredIconPath(filePath: string): boolean {
  const candidate = normalizedIconPath(filePath);
  return registry.apps.some((appRecord) => appRecord.iconPath && normalizedIconPath(appRecord.iconPath) === candidate);
}

function registerIconProtocol(): void {
  protocol.handle("appshelf-icon", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const filePath = decodeURIComponent(requestUrl.pathname.slice(1));
      const mimeType = allowedIconMimeTypes.get(extname(filePath).toLowerCase());

      if (requestUrl.hostname !== "icon" || !filePath || !mimeType || !isRegisteredIconPath(filePath)) {
        return new Response(null, { status: 404 });
      }

      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile() || fileInfo.size > maxIconBytes) {
        return new Response(null, { status: 404 });
      }

      const data = await readFile(filePath);
      return new Response(data, {
        headers: {
          "content-type": mimeType,
          "cache-control": "no-store"
        }
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "AppShelf",
    icon: appIconPath,
    autoHideMenuBar: true,
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("close", async (event) => {
    const behavior = registry.settings.closeBehavior;

    if (behavior === "exit") return;

    if (behavior === "tray") {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    event.preventDefault();
    const result = await dialog.showMessageBox(mainWindow!, {
      type: "question",
      buttons: ["Hide to tray", "Exit"],
      defaultId: 0,
      cancelId: 0,
      message: "Close AppShelf?",
      detail: "You can hide it to the tray or exit the app."
    });

    if (result.response === 0) {
      mainWindow?.hide();
    } else {
      registry.settings.closeBehavior = "exit";
      saveRegistry(registry);
      app.quit();
    }
  });
}

function createTray(): void {
  const image = nativeImage.createFromPath(trayIconPath);
  const fallbackImage = nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 });
  const trayImage = image.isEmpty() ? fallbackImage : image;

  tray = new Tray(trayImage);
  tray.setToolTip("AppShelf");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show AppShelf",
        click: () => mainWindow?.show()
      },
      {
        label: "Exit",
        click: () => {
          registry.settings.closeBehavior = "exit";
          saveRegistry(registry);
          app.quit();
        }
      }
    ])
  );
}

function registerIpc(): void {
  ipcMain.handle("registry:get", () => registry);

  ipcMain.handle("settings:update", (_event, settings: Partial<UserSettings>) => {
    registry.settings = { ...registry.settings, ...settings };
    saveRegistry(registry);
    return registry;
  });

  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"]
    });

    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("dialog:selectIconFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "svg", "ico"]
        }
      ]
    });

    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("scan:addFolder", async (_event, folder: string) => {
    if (!registry.settings.scanFolders.includes(folder)) {
      registry.settings.scanFolders.push(folder);
    }

    const scanResult = await scanFolders(registry.settings.scanFolders);
    applyScanResult(scanResult);
    return registry;
  });

  ipcMain.handle("scan:previewFolder", async (_event, folder: string) => {
    const scanResult = await scanFolders([folder]);
    return {
      ...scanResult,
      folder
    };
  });

  ipcMain.handle("scan:removeFolder", async (_event, folder: string) => {
    registry = removeAppsFromScanFolder(registry, folder);

    const scanResult = await scanFolders(registry.settings.scanFolders);
    applyScanResult(scanResult);
    return registry;
  });

  ipcMain.handle("scan:run", async () => {
    const scanResult = await scanFolders(registry.settings.scanFolders);
    applyScanResult(scanResult);
    sendToRenderer("scan:complete", registry);
    return registry;
  });

  ipcMain.handle("app:createManual", async (_event, input: ManualAppInput) => {
    const duplicateApp = findDuplicateAppForProject(registry, input.projectPath);
    if (duplicateApp) {
      return { ok: false, reason: "duplicateAppExists", app: duplicateApp };
    }

    const removedManifestPath = findRemovedManifestForProject(registry, input.projectPath);
    if (removedManifestPath) {
      return { ok: false, reason: "removedAppExists", manifestPath: removedManifestPath };
    }

    const record = await createManualApp(input);
    registry.apps = registry.apps.filter((appRecord) => appRecord.id !== record.id);
    registry.apps.push(record);
    saveRegistry(registry);
    return { ok: true, registry, appId: record.id };
  });

  ipcMain.handle("app:update", async (_event, input: AppConfigInput) => {
    const existing = findApp(input.id);
    if (!existing) return registry;

    const updated = await updateAppConfig(existing, input);
    registry.apps = registry.apps.map((appRecord) => (appRecord.id === input.id ? updated : appRecord));
    saveRegistry(registry);
    return registry;
  });

  ipcMain.handle("app:remove", async (_event, appId: string) => {
    const result = removeAppFromLibrary(registry, appId, {
      isProcessRunning: (currentAppId) => processManager.isRunning(currentAppId)
    });
    registry = result.registry;
    if (result.removed) {
      saveRegistry(registry);
    }
    return registry;
  });

  ipcMain.handle("app:restoreHiddenManifest", async (_event, manifestPath: string) => {
    registry = restoreLibraryHiddenManifest(registry, manifestPath);

    const scanResult = await scanFolders(registry.settings.scanFolders);
    applyScanResult(scanResult);
    return registry;
  });

  ipcMain.handle("app:start", async (_event, appId: string, trustCommand = false) => {
    return startAppById(appId, trustCommand);
  });

  ipcMain.handle("app:stop", async (_event, appId: string, stopExternal = false) => {
    const appRecord = findApp(appId);
    if (!appRecord) return registry;

    if (!processManager.isRunning(appId) && appRecord.status === "external") {
      if (stopExternal) {
        await processManager.stopExternalByPort(appId, appRecord.port);
      }
      return registry;
    }

    await processManager.stop(appId);
    return registry;
  });

  ipcMain.handle("app:restart", async (_event, appId: string) => {
    await processManager.stop(appId);
    return startAppById(appId, true);
  });

  ipcMain.handle("app:openUrl", async (_event, appId: string) => {
    const appRecord = findApp(appId);
    if (appRecord?.url) {
      await shell.openExternal(appRecord.url);
    }
  });

  ipcMain.handle("app:openFolder", async (_event, appId: string) => {
    const appRecord = findApp(appId);
    if (appRecord) {
      await shell.openPath(appRecord.projectPath);
    }
  });
}

app.whenReady().then(async () => {
  registry = loadRegistry();
  registerIconProtocol();
  registerIpc();
  await createWindow();
  createTray();

  if (registry.settings.scanFolders.length > 0) {
    const scanResult = await scanFolders(registry.settings.scanFolders);
    applyScanResult(scanResult);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
