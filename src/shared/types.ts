export type Language = "zh" | "en";

export type ViewMode = "cards" | "list";

export type CloseBehavior = "ask" | "tray" | "exit";

export type Theme = "light" | "dark";

export type AppStatus = "stopped" | "starting" | "running" | "external" | "unreachable" | "failed";

export type LocalAppManifest = {
  $schema?: string;
  name: string;
  description?: string;
  icon?: string;
  command: string;
  url?: string;
  port?: number;
  workingDirectory?: string;
};

export type AppRecord = {
  id: string;
  name: string;
  description?: string;
  iconPath?: string;
  command: string;
  url?: string;
  port?: number;
  projectPath: string;
  manifestPath?: string;
  workingDirectory: string;
  source: "manifest" | "manual";
  status: AppStatus;
  processId?: number;
  externalProcessIds?: number[];
  trustedCommandHash?: string;
  lastErrorSummary?: string;
};

export type UserSettings = {
  language: Language;
  theme: Theme;
  viewMode: ViewMode;
  autoOpenBrowser: boolean;
  closeBehavior: CloseBehavior;
  scanFolders: string[];
};

export type ScanDiagnosticKind = "folderMissing" | "folderUnreadable" | "emptyFolder" | "invalidManifest";

export type ScanDiagnostic = {
  kind: ScanDiagnosticKind;
  path: string;
  detail?: string;
};

export type ScanSummary = {
  scannedAt: number;
  discoveredCount: number;
  diagnostics: ScanDiagnostic[];
};

export type ScanResult = {
  apps: AppRecord[];
  diagnostics: ScanDiagnostic[];
  scannedAt: number;
};

export type UserRegistry = {
  version: 0;
  settings: UserSettings;
  apps: AppRecord[];
  hiddenManifestPaths: string[];
  lastScan?: ScanSummary;
};

export type LogEntry = {
  appId: string;
  stream: "stdout" | "stderr" | "system";
  line: string;
  timestamp: number;
};

export type AppStatusUpdate = {
  appId: string;
  status: AppStatus;
  errorSummary?: string;
  processId?: number;
  externalProcessIds?: number[];
};

export type ManualAppInput = {
  name: string;
  description?: string;
  iconPath?: string;
  command: string;
  url?: string;
  port?: number;
  projectPath: string;
  writeManifest: boolean;
};

export type AppConfigInput = {
  id: string;
  name: string;
  description?: string;
  iconPath?: string;
  command: string;
  url?: string;
  port?: number;
};

export type CreateManualAppResult =
  | { ok: true; registry: UserRegistry; appId: string }
  | { ok: false; reason: "removedAppExists"; manifestPath: string }
  | { ok: false; reason: "duplicateAppExists"; app: AppRecord };

export type StartResult =
  | { ok: true }
  | {
      ok: false;
      needsTrust: true;
      appId: string;
      appName: string;
      command: string;
      workingDirectory: string;
      manifestPath?: string;
      source: "manifest" | "manual";
    }
  | { ok: false; error: string };
