import { contextBridge, ipcRenderer } from "electron";
import type {
  AppConfigInput,
  AppStatusUpdate,
  CreateManualAppResult,
  FolderImportPreview,
  LogEntry,
  ManualAppInput,
  UserRegistry,
  UserSettings,
  StartResult
} from "../shared/types";

const api = {
  getRegistry: (): Promise<UserRegistry> => ipcRenderer.invoke("registry:get"),
  updateSettings: (settings: Partial<UserSettings>): Promise<UserRegistry> =>
    ipcRenderer.invoke("settings:update", settings),
  selectFolder: (): Promise<string | undefined> => ipcRenderer.invoke("dialog:selectFolder"),
  selectIconFile: (): Promise<string | undefined> => ipcRenderer.invoke("dialog:selectIconFile"),
  previewImportFolder: (folder: string): Promise<FolderImportPreview> => ipcRenderer.invoke("scan:previewFolder", folder),
  addScanFolder: (folder: string): Promise<UserRegistry> => ipcRenderer.invoke("scan:addFolder", folder),
  removeScanFolder: (folder: string): Promise<UserRegistry> => ipcRenderer.invoke("scan:removeFolder", folder),
  runScan: (): Promise<UserRegistry> => ipcRenderer.invoke("scan:run"),
  createManualApp: (input: ManualAppInput): Promise<CreateManualAppResult> =>
    ipcRenderer.invoke("app:createManual", input),
  updateApp: (input: AppConfigInput): Promise<UserRegistry> => ipcRenderer.invoke("app:update", input),
  removeApp: (appId: string): Promise<UserRegistry> => ipcRenderer.invoke("app:remove", appId),
  restoreHiddenManifest: (manifestPath: string): Promise<UserRegistry> =>
    ipcRenderer.invoke("app:restoreHiddenManifest", manifestPath),
  startApp: (appId: string, trustCommand?: boolean): Promise<StartResult> =>
    ipcRenderer.invoke("app:start", appId, trustCommand),
  stopApp: (appId: string, stopExternal?: boolean): Promise<UserRegistry> =>
    ipcRenderer.invoke("app:stop", appId, stopExternal),
  openUrl: (appId: string): Promise<void> => ipcRenderer.invoke("app:openUrl", appId),
  openFolder: (appId: string): Promise<void> => ipcRenderer.invoke("app:openFolder", appId),
  onLog: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry);
    ipcRenderer.on("app:log", listener);
    return () => ipcRenderer.removeListener("app:log", listener);
  },
  onStatus: (callback: (payload: AppStatusUpdate) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AppStatusUpdate) => callback(payload);
    ipcRenderer.on("app:status", listener);
    return () => ipcRenderer.removeListener("app:status", listener);
  }
};

contextBridge.exposeInMainWorld("appShelf", api);

export type AppShelfApi = typeof api;
