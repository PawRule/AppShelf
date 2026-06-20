import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FolderOpen,
  Grid2X2,
  Languages,
  List,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
  RotateCcw,
  ExternalLink,
  Copy,
  Pencil,
  Terminal,
  Trash2,
  X
} from "lucide-react";
import type {
  AppConfigInput,
  AppRecord,
  AppStatus,
  FolderImportPreview,
  LibrarySortMode,
  LogEntry,
  ManualAppInput,
  ScanDiagnostic,
  StartResult,
  Language,
  UserRegistry
} from "../../shared/types";
import { messages, type MessageKey } from "./i18n";
import appShelfIcon from "./assets/appshelf-icon.png";
import "./styles.css";

const statusClass: Record<AppStatus, string> = {
  stopped: "neutral",
  starting: "warning",
  running: "success",
  external: "external",
  unreachable: "danger",
  failed: "danger"
};

type ConfirmDialogRequest = {
  title: string;
  body: string;
  details?: Array<{ label: string; value?: string }>;
  confirmLabel: string;
  tone?: "default" | "danger";
};

type PendingConfirmDialog = ConfirmDialogRequest & {
  resolve: (confirmed: boolean) => void;
};

function fallbackRegistry(): UserRegistry {
  return {
    version: 0,
    settings: {
      language: "zh",
      theme: "light",
      viewMode: "cards",
      sortMode: "added",
      autoOpenBrowser: true,
      closeBehavior: "ask",
      scanFolders: []
    },
    apps: [],
    hiddenManifestPaths: [],
    lastScan: undefined
  };
}

function App(): React.JSX.Element {
  const [registry, setRegistry] = useState<UserRegistry>(fallbackRegistry());
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppRecord | undefined>();
  const [pendingTrust, setPendingTrust] = useState<Extract<StartResult, { needsTrust: true }> | undefined>();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmDialog | undefined>();
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});

  const t = (key: MessageKey) => messages[registry.settings.language][key];

  useEffect(() => {
    void window.appShelf.getRegistry().then((next) => {
      setRegistry(next);
      setSelectedId(next.apps[0]?.id);
    });

    const offLog = window.appShelf.onLog((entry) => {
      setLogs((current) => {
        const appLogs = [...(current[entry.appId] ?? []), entry].slice(-500);
        return { ...current, [entry.appId]: appLogs };
      });
    });

    const offStatus = window.appShelf.onStatus((payload) => {
      setRegistry((current) => ({
        ...current,
        apps: current.apps.map((app) => {
          if (app.id !== payload.appId) return app;

          return {
            ...app,
            status: payload.status,
            lastErrorSummary: payload.errorSummary,
            processId: Object.hasOwn(payload, "processId") ? payload.processId : app.processId,
            externalProcessIds: Object.hasOwn(payload, "externalProcessIds")
              ? payload.externalProcessIds
              : app.externalProcessIds
          };
        })
      }));
    });

    return () => {
      offLog();
      offStatus();
    };
  }, []);

  const filteredApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sortedApps = sortApps(registry.apps, registry.settings.sortMode);
    if (!normalized) return sortedApps;

    return sortedApps.filter((app) =>
      [app.name, app.description, app.projectPath, app.command, app.url]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
  }, [query, registry.apps, registry.settings.sortMode]);

  const selectedApp = registry.apps.find((app) => app.id === selectedId) ?? filteredApps[0];

  async function refresh(): Promise<void> {
    const next = await window.appShelf.runScan();
    setRegistry(next);
    setSelectedId((current) => current ?? next.apps[0]?.id);
  }

  async function startApp(app: AppRecord): Promise<void> {
    const result = await window.appShelf.startApp(app.id);

    if (!result.ok && "needsTrust" in result && result.needsTrust) {
      setPendingTrust(result);
      return;
    }

    if (!result.ok && "error" in result) {
      window.alert(result.error);
    }
  }

  async function stopApp(app: AppRecord): Promise<void> {
    let stopExternal = false;

    if (app.status === "external") {
      if (!app.port) {
        window.alert(t("externalStopNoPort"));
        return;
      }

      stopExternal = await requestConfirm({
        title: t("externalStopTitle"),
        body: t("externalStopBody"),
        details: [
          { label: t("appName"), value: app.name },
          { label: t("port"), value: app.port.toString() },
          { label: t("externalProcessIds"), value: app.externalProcessIds?.join(", ") }
        ],
        confirmLabel: t("stop"),
        tone: "danger"
      });
      if (!stopExternal) return;
    }

    const next = await window.appShelf.stopApp(app.id, stopExternal);
    setRegistry(next);
  }

  async function restartApp(app: AppRecord): Promise<void> {
    await stopApp(app);
    await startApp(app);
  }

  async function removeApp(app: AppRecord): Promise<void> {
    const isActive =
      app.status === "running" || app.status === "external" || app.status === "starting" || app.status === "unreachable";

    if (isActive) {
      window.alert(t("removeRunningApp"));
      return;
    }

    const message = app.manifestPath ? t("removeScannedAppConfirm") : t("removeManualAppConfirm");
    const confirmed = await requestConfirm({
      title: t("removeAppTitle"),
      body: message,
      details: [
        { label: t("appName"), value: app.name },
        { label: t("projectPath"), value: app.projectPath },
        { label: t("manifestPath"), value: app.manifestPath }
      ],
      confirmLabel: t("remove"),
      tone: "danger"
    });
    if (!confirmed) return;

    const next = await window.appShelf.removeApp(app.id);
    setRegistry(next);
    setSelectedId((current) => (current === app.id ? next.apps[0]?.id : current));
  }

  async function updateSettings(patch: Partial<UserRegistry["settings"]>): Promise<void> {
    const next = await window.appShelf.updateSettings(patch);
    setRegistry(next);
  }

  function requestConfirm(request: ConfirmDialogRequest): Promise<boolean> {
    return new Promise((resolve) => {
      setPendingConfirm({ ...request, resolve });
    });
  }

  function resolveConfirmDialog(confirmed: boolean): void {
    pendingConfirm?.resolve(confirmed);
    setPendingConfirm(undefined);
  }

  async function confirmTrustedCommand(): Promise<void> {
    if (!pendingTrust) return;

    const result = await window.appShelf.startApp(pendingTrust.appId, true);
    setPendingTrust(undefined);

    if (!result.ok && "error" in result) {
      window.alert(result.error);
    }
  }

  return (
    <div className="app-shell" data-theme={registry.settings.theme}>
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={appShelfIcon} alt="" />
          <div>
            <h1>AppShelf</h1>
            <p>Localhost Project Library</p>
          </div>
        </div>

        <div className="searchbox">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
        </div>

        <div className="toolbar-actions">
          <button className="icon-button" onClick={refresh} title={t("refresh")}>
            <RefreshCw size={18} />
          </button>
          <select
            className="sort-select"
            value={registry.settings.sortMode}
            aria-label={t("sortMode")}
            onChange={(event) =>
              void updateSettings({ sortMode: event.target.value as UserRegistry["settings"]["sortMode"] })
            }
          >
            <option value="added">{t("sortAdded")}</option>
            <option value="nameAsc">{t("sortNameAsc")}</option>
            <option value="nameDesc">{t("sortNameDesc")}</option>
          </select>
          <button
            className={`segmented ${registry.settings.viewMode === "cards" ? "active" : ""}`}
            onClick={() => void updateSettings({ viewMode: "cards" })}
          >
            <Grid2X2 size={16} />
            {t("cardView")}
          </button>
          <button
            className={`segmented ${registry.settings.viewMode === "list" ? "active" : ""}`}
            onClick={() => void updateSettings({ viewMode: "list" })}
          >
            <List size={16} />
            {t("listView")}
          </button>
          <button className="primary-button" onClick={() => setAddOpen(true)}>
            <Plus size={18} />
            {t("addApp")}
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} title={t("settings")}>
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="main-layout">
        <section className="library">
          {filteredApps.length === 0 ? (
            <EmptyState t={t} onAdd={() => setAddOpen(true)} />
          ) : registry.settings.viewMode === "cards" ? (
            <div className="card-grid">
              {filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  selected={app.id === selectedApp?.id}
                  t={t}
                  onSelect={() => setSelectedId(app.id)}
                  onStart={() => void startApp(app)}
                  onStop={() => void stopApp(app)}
                  onOpen={() => void window.appShelf.openUrl(app.id)}
                  onRemove={() => void removeApp(app)}
                />
              ))}
            </div>
          ) : (
            <AppList
              apps={filteredApps}
              selectedId={selectedApp?.id}
              t={t}
              onSelect={setSelectedId}
              onStart={(app) => void startApp(app)}
              onStop={(app) => void stopApp(app)}
              onOpen={(app) => void window.appShelf.openUrl(app.id)}
              onRemove={(app) => void removeApp(app)}
            />
          )}
        </section>

        <DetailDrawer
          app={selectedApp}
          entries={selectedApp ? logs[selectedApp.id] ?? [] : []}
          t={t}
          language={registry.settings.language}
          onStart={(app) => void startApp(app)}
          onStop={(app) => void stopApp(app)}
          onRestart={(app) => void restartApp(app)}
          onEdit={(app) => setEditingApp(app)}
          onRemove={(app) => void removeApp(app)}
        />
      </main>

      {settingsOpen ? (
        <SettingsPanel
          registry={registry}
          t={t}
          onClose={() => setSettingsOpen(false)}
          onUpdate={updateSettings}
          onRegistry={setRegistry}
          onConfirm={requestConfirm}
        />
      ) : null}

      {addOpen ? (
        <ManualAppDialog
          registry={registry}
          t={t}
          language={registry.settings.language}
          onClose={() => setAddOpen(false)}
          onConfirm={requestConfirm}
          onSelectExisting={(appId) => {
            setQuery("");
            setSelectedId(appId);
            setAddOpen(false);
          }}
          onSaved={(next, appId) => {
            setRegistry(next);
            setSelectedId(appId ?? next.apps.at(-1)?.id);
            setAddOpen(false);
          }}
        />
      ) : null}

      {editingApp ? (
        <AppConfigDialog
          app={editingApp}
          t={t}
          onClose={() => setEditingApp(undefined)}
          onSaved={(next) => {
            setRegistry(next);
            setSelectedId(editingApp.id);
            setEditingApp(undefined);
          }}
        />
      ) : null}

      {pendingTrust ? (
        <CommandTrustDialog
          request={pendingTrust}
          t={t}
          onCancel={() => setPendingTrust(undefined)}
          onConfirm={() => void confirmTrustedCommand()}
        />
      ) : null}

      {pendingConfirm ? (
        <ConfirmDialog
          request={pendingConfirm}
          t={t}
          onCancel={() => resolveConfirmDialog(false)}
          onConfirm={() => resolveConfirmDialog(true)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ t, onAdd }: { t: (key: MessageKey) => string; onAdd: () => void }): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Terminal size={34} />
      </div>
      <h2>{t("noApps")}</h2>
      <p>{t("noAppsHint")}</p>
      <button className="primary-button" onClick={onAdd}>
        <Plus size={18} />
        {t("addApp")}
      </button>
    </div>
  );
}

function AppIcon({ app }: { app: AppRecord }): React.JSX.Element {
  if (app.iconPath) {
    return <img className="app-icon image" src={`appshelf-icon://icon/${encodeURIComponent(app.iconPath)}`} alt="" />;
  }

  return <div className="app-icon">{app.name.slice(0, 1).toUpperCase()}</div>;
}

function CopyableAddress({
  text,
  t,
  className = ""
}: {
  text: string;
  t: (key: MessageKey) => string;
  className?: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(event: React.MouseEvent | React.KeyboardEvent): Promise<void> {
    event.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function copyFromKeyboard(event: React.KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void copy(event);
  }

  return (
    <span
      className={`copyable-address ${className}`}
      role="button"
      tabIndex={0}
      onClick={(event) => void copy(event)}
      onKeyDown={copyFromKeyboard}
      title={t("copyUrlHint")}
    >
      <span className="copyable-address-text">{text}</span>
      <span className={`copyable-address-action ${copied ? "copied" : ""}`} aria-live="polite">
        {copied ? t("copied") : <Copy size={14} />}
      </span>
    </span>
  );
}

function sortApps(apps: AppRecord[], sortMode: LibrarySortMode): AppRecord[] {
  if (sortMode === "added") return apps;

  const direction = sortMode === "nameAsc" ? 1 : -1;
  return [...apps].sort((a, b) => direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function AppCard({
  app,
  selected,
  t,
  onSelect,
  onStart,
  onStop,
  onOpen,
  onRemove
}: {
  app: AppRecord;
  selected: boolean;
  t: (key: MessageKey) => string;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onOpen: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  const isRunning =
    app.status === "running" || app.status === "external" || app.status === "starting" || app.status === "unreachable";
  const urlText = app.url ?? app.command;

  return (
    <article className={`app-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="card-head">
        <AppIcon app={app} />
        <span className={`status-pill ${statusClass[app.status]}`}>{t(app.status)}</span>
      </div>
      <h2>{app.name}</h2>
      <p>{app.description || app.projectPath}</p>
      <div className="card-footer">
        <CopyableAddress text={urlText} t={t} className="url-line" />
      </div>
      <div className="card-actions">
        {isRunning ? (
          <button className="danger-button" onClick={(event) => void withStop(event, onStop)}>
            <Square size={16} />
            {t("stop")}
          </button>
        ) : (
          <button className="primary-button" onClick={(event) => void withStop(event, onStart)}>
            <Play size={16} />
            {t("start")}
          </button>
        )}
        <button className="secondary-button" onClick={(event) => void withStop(event, onOpen)} disabled={!app.url}>
          <ExternalLink size={16} />
          {t("open")}
        </button>
        <button className="secondary-button" onClick={(event) => void withStop(event, onRemove)}>
          <Trash2 size={16} />
          {t("remove")}
        </button>
      </div>
    </article>
  );
}

function AppList({
  apps,
  selectedId,
  t,
  onSelect,
  onStart,
  onStop,
  onOpen,
  onRemove
}: {
  apps: AppRecord[];
  selectedId?: string;
  t: (key: MessageKey) => string;
  onSelect: (id: string) => void;
  onStart: (app: AppRecord) => void;
  onStop: (app: AppRecord) => void;
  onOpen: (app: AppRecord) => void;
  onRemove: (app: AppRecord) => void;
}): React.JSX.Element {
  return (
    <div className="app-table">
      {apps.map((app) => {
        const isRunning =
          app.status === "running" ||
          app.status === "external" ||
          app.status === "starting" ||
          app.status === "unreachable";

        return (
          <article
            className={`app-row ${app.id === selectedId ? "selected" : ""}`}
            key={app.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(app.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelect(app.id);
            }}
          >
            <AppIcon app={app} />
            <span className="row-main">
              <strong>{app.name}</strong>
              <CopyableAddress text={app.url ?? app.projectPath} t={t} className="row-copy-line" />
            </span>
            <span className={`status-pill ${statusClass[app.status]}`}>{t(app.status)}</span>
            <span className="row-command">{app.command}</span>
            <span className="row-actions">
              <span className="mini-action" onClick={(event) => withStop(event, () => (isRunning ? onStop(app) : onStart(app)))}>
                {isRunning ? <Square size={15} /> : <Play size={15} />}
              </span>
              <span className="mini-action" onClick={(event) => withStop(event, () => onOpen(app))}>
                <ExternalLink size={15} />
              </span>
              <span className="mini-action" onClick={(event) => withStop(event, () => onRemove(app))}>
                <Trash2 size={15} />
              </span>
            </span>
          </article>
        );
      })}
    </div>
  );
}

function DetailDrawer({
  app,
  entries,
  t,
  language,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onRemove
}: {
  app?: AppRecord;
  entries: LogEntry[];
  t: (key: MessageKey) => string;
  language: Language;
  onStart: (app: AppRecord) => void;
  onStop: (app: AppRecord) => void;
  onRestart: (app: AppRecord) => void;
  onEdit: (app: AppRecord) => void;
  onRemove: (app: AppRecord) => void;
}): React.JSX.Element {
  if (!app) {
    return <aside className="detail-drawer empty">{t("details")}</aside>;
  }

  const logText = entries.map((entry) => `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.line}`).join("\n");
  const repairPrompt = app.lastErrorSummary ? buildRepairPrompt(app, entries, language) : "";
  const isRunning =
    app.status === "running" || app.status === "external" || app.status === "starting" || app.status === "unreachable";

  return (
    <aside className="detail-drawer">
      <div className="drawer-head">
        <AppIcon app={app} />
        <div>
          <h2>{app.name}</h2>
          <span className={`status-pill ${statusClass[app.status]}`}>{t(app.status)}</span>
        </div>
      </div>

      <div className="drawer-actions">
        {isRunning ? (
          <button className="danger-button" onClick={() => onStop(app)}>
            <Square size={16} />
            {t("stop")}
          </button>
        ) : (
          <button className="primary-button" onClick={() => onStart(app)}>
            <Play size={16} />
            {t("start")}
          </button>
        )}
        <button className="secondary-button" onClick={() => onRestart(app)}>
          <RotateCcw size={16} />
          {t("restart")}
        </button>
        <button className="secondary-button" onClick={() => void window.appShelf.openUrl(app.id)} disabled={!app.url}>
          <ExternalLink size={16} />
          {t("open")}
        </button>
        <button className="secondary-button" onClick={() => onEdit(app)}>
          <Pencil size={16} />
          {t("editConfig")}
        </button>
        <span className="drawer-action-spacer" aria-hidden="true" />
        <button className="secondary-button" onClick={() => onRemove(app)}>
          <Trash2 size={16} />
          {t("remove")}
        </button>
      </div>

      <dl className="metadata">
        <Meta label={t("description")} value={app.description} />
        <Meta label={t("projectPath")} value={app.projectPath} />
        <Meta label={t("manifestPath")} value={app.manifestPath} />
        <Meta label={t("command")} value={app.command} />
        <Meta label={t("url")} value={app.url} />
        <Meta label={t("port")} value={app.port?.toString()} />
        <Meta label={t("processId")} value={app.processId?.toString()} />
        <Meta label={t("externalProcessIds")} value={app.externalProcessIds?.join(", ")} />
        <Meta label={t("source")} value={app.source === "manifest" ? t("manifest") : t("manual")} />
      </dl>

      <button className="secondary-button full" onClick={() => void window.appShelf.openFolder(app.id)}>
        <FolderOpen size={16} />
        {t("openFolder")}
      </button>

      {app.lastErrorSummary ? (
        <section className="error-box">
          <div className="section-title">
            <span>{t("errorSummary")}</span>
            <span className="section-actions">
              <button className="ghost-button" onClick={() => void navigator.clipboard.writeText(app.lastErrorSummary ?? "")}>
                <Copy size={14} />
                {t("copyError")}
              </button>
              <button className="ghost-button" onClick={() => void navigator.clipboard.writeText(repairPrompt)}>
                <Copy size={14} />
                {t("copyRepairPrompt")}
              </button>
            </span>
          </div>
          <pre>{app.lastErrorSummary}</pre>
        </section>
      ) : null}

      <section className="log-panel">
        <div className="section-title">
          <span>{t("logs")}</span>
          <button className="ghost-button" onClick={() => void navigator.clipboard.writeText(logText)}>
            <Copy size={14} />
            {t("copyLogs")}
          </button>
        </div>
        <pre>{logText || t("emptyLogs")}</pre>
      </section>
    </aside>
  );
}

function Meta({ label, value }: { label: string; value?: string }): React.JSX.Element | null {
  if (!value) return null;

  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function buildRepairPrompt(app: AppRecord, entries: LogEntry[], language: Language): string {
  const recentLogs = entries
    .slice(-80)
    .map((entry) => `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.line}`)
    .join("\n");

  if (language === "zh") {
    return [
      "请帮我修复这个 localhost 项目的启动问题。",
      "",
      "背景：这个项目由 AppShelf 启动失败，或者启动后本地 URL 不可达。请检查项目依赖、启动命令、端口配置和 .localapp.json。如需修改配置，请保持 AppShelf 可以继续一键启动。",
      "",
      `应用名称：${app.name}`,
      `项目路径：${app.projectPath}`,
      `Manifest：${app.manifestPath ?? "无"}`,
      `启动命令：${app.command}`,
      `工作目录：${app.workingDirectory}`,
      `URL：${app.url ?? "未配置"}`,
      `端口：${app.port?.toString() ?? "未配置"}`,
      "",
      "错误摘要：",
      app.lastErrorSummary ?? "无",
      "",
      "最近日志：",
      recentLogs || "无"
    ].join("\n");
  }

  return [
    "Please help me fix this localhost project startup issue.",
    "",
    "Context: AppShelf failed to start this project, or the local URL did not become reachable after startup. Please check dependencies, the start command, port configuration, and .localapp.json. If config changes are needed, keep the project launchable from AppShelf.",
    "",
    `App name: ${app.name}`,
    `Project path: ${app.projectPath}`,
    `Manifest: ${app.manifestPath ?? "None"}`,
    `Start command: ${app.command}`,
    `Working directory: ${app.workingDirectory}`,
    `URL: ${app.url ?? "Not configured"}`,
    `Port: ${app.port?.toString() ?? "Not configured"}`,
    "",
    "Error summary:",
    app.lastErrorSummary ?? "None",
    "",
    "Recent logs:",
    recentLogs || "None"
  ].join("\n");
}

function formatScanTime(timestamp: number, language: UserRegistry["settings"]["language"]): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

function scanDiagnosticLabel(diagnostic: ScanDiagnostic, t: (key: MessageKey) => string): string {
  switch (diagnostic.kind) {
    case "folderMissing":
      return t("scanIssueMissing");
    case "folderUnreadable":
      return t("scanIssueUnreadable");
    case "emptyFolder":
      return t("scanIssueEmpty");
    case "invalidManifest":
      return t("scanIssueInvalid");
  }
}

function CommandTrustDialog({
  request,
  t,
  onCancel,
  onConfirm
}: {
  request: Extract<StartResult, { needsTrust: true }>;
  t: (key: MessageKey) => string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div className="modal-backdrop">
      <section className="panel trust-panel">
        <PanelHead title={t("commandTrustTitle")} onClose={onCancel} />

        <div className="trust-content">
          <p>{t("commandTrustBody")}</p>

          <pre className="command-preview">{request.command}</pre>

          <dl className="metadata compact">
            <Meta label={t("appName")} value={request.appName} />
            <Meta label={t("source")} value={request.source === "manifest" ? t("manifest") : t("manual")} />
            <Meta label={t("workingDirectory")} value={request.workingDirectory} />
            <Meta label={t("manifestPath")} value={request.manifestPath} />
          </dl>

          {request.manifestPath ? <p className="trust-warning">{t("commandTrustManifestWarning")}</p> : null}
          <p className="trust-note">{t("commandTrustRemember")}</p>
        </div>

        <div className="panel-actions">
          <button className="secondary-button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className="primary-button" onClick={onConfirm}>
            {t("runAndTrust")}
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfirmDialog({
  request,
  t,
  onCancel,
  onConfirm
}: {
  request: ConfirmDialogRequest;
  t: (key: MessageKey) => string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div className="modal-backdrop">
      <section className="panel confirm-panel">
        <PanelHead title={request.title} onClose={onCancel} />

        <div className="confirm-content">
          <p>{request.body}</p>

          {request.details?.length ? (
            <dl className="metadata compact">
              {request.details.map((detail) => (
                <Meta key={detail.label} label={detail.label} value={detail.value} />
              ))}
            </dl>
          ) : null}
        </div>

        <div className="panel-actions">
          <button className="secondary-button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className={request.tone === "danger" ? "danger-button" : "primary-button"} onClick={onConfirm}>
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsPanel({
  registry,
  t,
  onClose,
  onUpdate,
  onRegistry,
  onConfirm
}: {
  registry: UserRegistry;
  t: (key: MessageKey) => string;
  onClose: () => void;
  onUpdate: (patch: Partial<UserRegistry["settings"]>) => Promise<void>;
  onRegistry: (registry: UserRegistry) => void;
  onConfirm: (request: ConfirmDialogRequest) => Promise<boolean>;
}): React.JSX.Element {
  async function addFolder(): Promise<void> {
    const folder = await window.appShelf.selectFolder();
    if (folder) {
      const next = await window.appShelf.addScanFolder(folder);
      onRegistry(next);
    }
  }

  async function removeFolder(folder: string): Promise<void> {
    const confirmed = await onConfirm({
      title: t("removeScanFolderTitle"),
      body: t("removeScanFolderConfirm"),
      details: [{ label: t("scanFolders"), value: folder }],
      confirmLabel: t("remove"),
      tone: "danger"
    });
    if (!confirmed) return;

    const next = await window.appShelf.removeScanFolder(folder);
    onRegistry(next);
  }

  async function restoreHiddenManifest(manifestPath: string): Promise<void> {
    const next = await window.appShelf.restoreHiddenManifest(manifestPath);
    onRegistry(next);
  }

  return (
    <div className="modal-backdrop">
      <section className="panel settings-panel">
        <PanelHead title={t("settings")} onClose={onClose} />

        <label className="field-row">
          <span>{t("language")}</span>
          <select
            value={registry.settings.language}
            onChange={(event) => void onUpdate({ language: event.target.value as UserRegistry["settings"]["language"] })}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="field-row">
          <span>{t("theme")}</span>
          <select
            value={registry.settings.theme}
            onChange={(event) => void onUpdate({ theme: event.target.value as UserRegistry["settings"]["theme"] })}
          >
            <option value="light">{t("lightTheme")}</option>
            <option value="dark">{t("darkTheme")}</option>
          </select>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={registry.settings.autoOpenBrowser}
            onChange={(event) => void onUpdate({ autoOpenBrowser: event.target.checked })}
          />
          {t("autoOpen")}
        </label>

        <label className="field-row">
          <span>{t("closeBehavior")}</span>
          <select
            value={registry.settings.closeBehavior}
            onChange={(event) =>
              void onUpdate({ closeBehavior: event.target.value as UserRegistry["settings"]["closeBehavior"] })
            }
          >
            <option value="ask">{t("ask")}</option>
            <option value="tray">{t("tray")}</option>
            <option value="exit">{t("exit")}</option>
          </select>
        </label>

        <div className="folder-section">
          <div className="section-title">
            <span>
              {t("scanFolders")} ({registry.settings.scanFolders.length})
            </span>
            <button className="secondary-button" onClick={addFolder}>
              <Plus size={16} />
              {t("addFolder")}
            </button>
          </div>
          <div className="folder-list">
            {registry.settings.scanFolders.map((folder) => (
              <div className="folder-row" key={folder}>
                <code title={folder}>{folder}</code>
                <button className="icon-button" onClick={() => void removeFolder(folder)} title={t("removeFolder")}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {registry.lastScan ? (
          <div className="folder-section scan-feedback">
            <div className="section-title">
              <span>{t("scanFeedback")}</span>
            </div>
            <p className="scan-summary">
              {t("lastScan")}: {formatScanTime(registry.lastScan.scannedAt, registry.settings.language)}
              <span>·</span>
              {t("foundApps")}: {registry.lastScan.discoveredCount}
            </p>
            {registry.lastScan.diagnostics.length > 0 ? (
              <div className="scan-diagnostics">
                {registry.lastScan.diagnostics.map((diagnostic) => (
                  <div className="scan-diagnostic" key={`${diagnostic.kind}:${diagnostic.path}`}>
                    <strong>{scanDiagnosticLabel(diagnostic, t)}</strong>
                    <code title={diagnostic.path}>{diagnostic.path}</code>
                    {diagnostic.detail ? <small>{diagnostic.detail}</small> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="scan-summary success">{t("noScanIssues")}</p>
            )}
          </div>
        ) : null}

        {registry.hiddenManifestPaths.length > 0 ? (
          <div className="folder-section">
            <div className="section-title">
              <span>
                {t("removedApps")} ({registry.hiddenManifestPaths.length})
              </span>
            </div>
            <div className="folder-list">
              {registry.hiddenManifestPaths.map((manifestPath) => (
                <div className="folder-row restore-row" key={manifestPath}>
                  <code title={manifestPath}>{manifestPath}</code>
                  <button className="secondary-button" onClick={() => void restoreHiddenManifest(manifestPath)}>
                    {t("restoreToLibrary")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ManualAppDialog({
  registry,
  t,
  language,
  onClose,
  onConfirm,
  onSelectExisting,
  onSaved
}: {
  registry: UserRegistry;
  t: (key: MessageKey) => string;
  language: Language;
  onClose: () => void;
  onConfirm: (request: ConfirmDialogRequest) => Promise<boolean>;
  onSelectExisting: (appId: string) => void;
  onSaved: (registry: UserRegistry, appId?: string) => void;
}): React.JSX.Element {
  const [input, setInput] = useState<ManualAppInput>({
    name: "",
    description: "",
    command: "npm run dev",
    url: "",
    projectPath: "",
    writeManifest: true
  });
  const [importPreview, setImportPreview] = useState<FolderImportPreview | undefined>();
  const [importBusy, setImportBusy] = useState(false);
  const [registrationPromptCopied, setRegistrationPromptCopied] = useState(false);

  const previewHiddenApps = importPreview?.apps.filter((app) => isHiddenManifest(registry, app)) ?? [];
  const previewNewApps =
    importPreview?.apps.filter((app) => !isHiddenManifest(registry, app) && !findExistingApp(registry, app)) ?? [];

  async function selectProject(): Promise<void> {
    const folder = await window.appShelf.selectFolder();
    if (folder) {
      setInput((current) => ({ ...current, projectPath: folder, name: current.name || folder.split(/[\\/]/).at(-1) || "" }));
    }
  }

  async function selectImportFolder(): Promise<void> {
    const folder = await window.appShelf.selectFolder();
    if (!folder) return;

    setInput((current) => ({ ...current, projectPath: folder, name: current.name || folder.split(/[\\/]/).at(-1) || "" }));
    setImportBusy(true);
    try {
      setImportPreview(await window.appShelf.previewImportFolder(folder));
    } finally {
      setImportBusy(false);
    }
  }

  async function addPreviewFolder(): Promise<void> {
    if (!importPreview) return;

    if (importPreview.apps.length === 0) {
      const next = await window.appShelf.addScanFolder(importPreview.folder);
      onSaved(next);
      return;
    }

    if (importPreview.apps.length > 0 && previewNewApps.length === 0 && previewHiddenApps.length === 0) {
      const existing = findExistingApp(registry, importPreview.apps[0]);
      if (existing) {
        onSelectExisting(existing.id);
      }
      return;
    }

    let next = await window.appShelf.addScanFolder(importPreview.folder);

    for (const app of previewHiddenApps) {
      if (app.manifestPath) {
        next = await window.appShelf.restoreHiddenManifest(app.manifestPath);
      }
    }

    const firstImported = [...previewNewApps, ...previewHiddenApps][0];
    onSaved(next, firstImported?.id ?? next.apps.at(-1)?.id);
  }

  async function selectIcon(): Promise<void> {
    const iconPath = await window.appShelf.selectIconFile();
    if (iconPath) {
      setInput((current) => ({ ...current, iconPath }));
    }
  }

  async function copyRegistrationPrompt(): Promise<void> {
    await navigator.clipboard.writeText(buildRegistrationPrompt(input, language));
    setRegistrationPromptCopied(true);
    window.setTimeout(() => setRegistrationPromptCopied(false), 1600);
  }

  async function save(): Promise<void> {
    const result = await window.appShelf.createManualApp({
      ...input,
      port: input.port ? Number(input.port) : undefined,
      description: input.description || undefined,
      url: input.url || undefined
    });

    if (result.ok) {
      onSaved(result.registry, result.appId);
      return;
    }

    if (result.reason === "removedAppExists") {
      const shouldRestore = await onConfirm({
        title: t("removedApps"),
        body: t("restoreRemovedAppConfirm"),
        details: [{ label: t("manifestPath"), value: result.manifestPath }],
        confirmLabel: t("restore")
      });
      if (!shouldRestore) return;

      const next = await window.appShelf.restoreHiddenManifest(result.manifestPath);
      onSaved(next);
      return;
    }

    if (result.reason === "duplicateAppExists") {
      const shouldView = await onConfirm({
        title: t("duplicateAppTitle"),
        body: t("duplicateAppBody"),
        details: [
          { label: t("appName"), value: result.app.name },
          { label: t("projectPath"), value: result.app.projectPath },
          { label: t("manifestPath"), value: result.app.manifestPath }
        ],
        confirmLabel: t("viewApp")
      });

      if (shouldView) {
        onSelectExisting(result.app.id);
      }
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="panel manual-panel">
        <PanelHead title={t("addApp")} onClose={onClose} />

        <section className="import-section">
          <div className="import-heading">
            <div>
              <h3>{t("importProject")}</h3>
              <p>{t("importProjectHint")}</p>
            </div>
            <button className="secondary-button" onClick={() => void selectImportFolder()} disabled={importBusy}>
              <FolderOpen size={16} />
              {importBusy ? t("scanning") : t("chooseProjectFolder")}
            </button>
          </div>

          {importPreview ? (
            <div className="import-preview">
              <code title={importPreview.folder}>{importPreview.folder}</code>

              {importPreview.apps.length > 0 ? (
                <>
                  <div className="import-result-title">
                    <strong>
                      {t("discoveredApps")} ({importPreview.apps.length})
                    </strong>
                    {previewNewApps.length > 0 ? <span>{t("newAppsFound")}: {previewNewApps.length}</span> : null}
                  </div>
                  <div className="import-app-list">
                    {importPreview.apps.map((app) => {
                      const existing = findExistingApp(registry, app);
                      const hidden = isHiddenManifest(registry, app);
                      return (
                        <div className="import-app-row" key={app.id}>
                          <AppIcon app={app} />
                          <div>
                            <strong>{app.name}</strong>
                            <small>{app.manifestPath}</small>
                          </div>
                          {hidden ? <span className="mini-badge warning">{t("removed")}</span> : null}
                          {existing ? <span className="mini-badge">{t("alreadyAdded")}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                  <button className="primary-button import-primary" onClick={() => void addPreviewFolder()}>
                    {previewNewApps.length > 0 || previewHiddenApps.length > 0 ? t("addDiscoveredApps") : t("viewApp")}
                  </button>
                </>
              ) : (
                <div className="import-empty">
                  <strong>{t("noManifestFound")}</strong>
                  <p>{t("noManifestFoundHint")}</p>
                  <div className="import-empty-actions">
                    <button className="secondary-button" onClick={() => void copyRegistrationPrompt()}>
                      <Copy size={16} />
                      {registrationPromptCopied ? t("copied") : t("copyRegistrationPrompt")}
                    </button>
                    <button className="secondary-button" onClick={() => void addPreviewFolder()}>
                      <Plus size={16} />
                      {t("addAsScanFolder")}
                    </button>
                  </div>
                </div>
              )}

              {importPreview.diagnostics.length > 0 ? (
                <div className="scan-diagnostics compact">
                  {importPreview.diagnostics.map((diagnostic) => (
                    <div className="scan-diagnostic" key={`${diagnostic.kind}:${diagnostic.path}`}>
                      <strong>{scanDiagnosticLabel(diagnostic, t)}</strong>
                      <code title={diagnostic.path}>{diagnostic.path}</code>
                      {diagnostic.detail ? <small>{diagnostic.detail}</small> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="form-divider">
          <span>{t("manualRegistration")}</span>
        </div>

        <label className="field">
          <span>
            {t("appName")} <em>{t("required")}</em>
          </span>
          <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
        </label>

        <label className="field">
          <span>
            {t("description")} <em>{t("optional")}</em>
          </span>
          <input
            value={input.description}
            onChange={(event) => setInput({ ...input, description: event.target.value })}
          />
        </label>

        <label className="field with-button">
          <span>
            {t("projectPath")} <em>{t("required")}</em>
          </span>
          <input
            value={input.projectPath}
            onChange={(event) => setInput({ ...input, projectPath: event.target.value })}
          />
          <button className="secondary-button" onClick={selectProject}>
            {t("select")}
          </button>
        </label>

        <label className="field with-actions">
          <span>
            {t("iconPath")} <em>{t("optional")}</em>
          </span>
          <input
            value={input.iconPath ?? ""}
            onChange={(event) => setInput({ ...input, iconPath: event.target.value })}
          />
          <button className="secondary-button" onClick={selectIcon}>
            {t("select")}
          </button>
          <button
            className="secondary-button"
            onClick={() => setInput((current) => ({ ...current, iconPath: undefined }))}
            disabled={!input.iconPath}
          >
            {t("clear")}
          </button>
          <small>{t("iconPathHint")}</small>
        </label>

        <label className="field">
          <span>
            {t("command")} <em>{t("required")}</em>
          </span>
          <input value={input.command} onChange={(event) => setInput({ ...input, command: event.target.value })} />
        </label>

        <div className="two-cols">
          <label className="field">
            <span>
              {t("url")} <em>{t("optional")}</em>
            </span>
            <input value={input.url} onChange={(event) => setInput({ ...input, url: event.target.value })} />
          </label>
          <label className="field">
            <span>
              {t("port")} <em>{t("optional")}</em>
            </span>
            <input
              type="number"
              value={input.port ?? ""}
              onChange={(event) =>
                setInput({ ...input, port: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </label>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={input.writeManifest}
            onChange={(event) => setInput({ ...input, writeManifest: event.target.checked })}
          />
          {t("writeManifest")}
        </label>

        <div className="agent-handoff">
          <div>
            <strong>{t("agentRegistration")}</strong>
            <p>{t("agentRegistrationHint")}</p>
          </div>
          <button className="secondary-button" onClick={() => void copyRegistrationPrompt()}>
            <Copy size={16} />
            {registrationPromptCopied ? t("copied") : t("copyRegistrationPrompt")}
          </button>
        </div>

        <div className="panel-actions">
          <button className="secondary-button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary-button" onClick={save} disabled={!input.name || !input.projectPath || !input.command}>
            {t("save")}
          </button>
        </div>
      </section>
    </div>
  );
}

function buildRegistrationPrompt(input: ManualAppInput, language: Language): string {
  const projectPath = input.projectPath.trim();
  const knownFields = [
    input.name.trim() ? `Name: ${input.name.trim()}` : undefined,
    projectPath ? `Project path: ${projectPath}` : undefined,
    input.command.trim() ? `Current guessed command: ${input.command.trim()}` : undefined,
    input.url?.trim() ? `URL: ${input.url.trim()}` : undefined,
    input.port ? `Port: ${input.port}` : undefined
  ].filter(Boolean);

  if (language === "zh") {
    return [
      "请帮我把这个 localhost 项目注册到 AppShelf。",
      "",
      "目标：创建或更新项目根目录的 .localapp.json，让 AppShelf 可以发现并一键启动它。",
      projectPath ? `项目路径：${projectPath}` : "项目路径：请以当前对话所在项目为准。",
      "",
      "请按这个顺序完成：",
      "1. 检查 package.json、README 和项目结构，确定启动命令、工作目录、URL 和端口。",
      "2. 先完成基础注册，不要因为图标阻塞注册。",
      "3. .localapp.json 使用英文 key；至少写入 name 和 command。如果能确认 URL 或 port，也写入。",
      "4. 如果只是静态站点且没有启动命令，可以在 .localapp/ 目录里创建一个小的本地启动适配器；不要修改业务代码，不要安装新依赖。",
      "5. 如果项目已有合适图标，优先登记 icon；否则最后询问我是否需要生成 .localapp/icon.png。",
      "6. 完成后验证 JSON 可解析，并告诉我启动命令、URL/端口，以及是否创建了 helper launcher。",
      "",
      "AppShelf 已知信息：",
      knownFields.length > 0 ? knownFields.join("\n") : "暂无，请从当前项目判断。"
    ].join("\n");
  }

  return [
    "Please register this localhost project for AppShelf.",
    "",
    "Goal: create or update .localapp.json in the project root so AppShelf can discover and start it with one click.",
    projectPath ? `Project path: ${projectPath}` : "Project path: use the current project in this conversation.",
    "",
    "Please follow this order:",
    "1. Inspect package.json, README, and the project structure to determine the start command, working directory, URL, and port.",
    "2. Complete the basic registration first; do not block registration on icon generation.",
    "3. Use English keys in .localapp.json. Include at least name and command. If URL or port is confirmed, include it too.",
    "4. If this is a static site with no start command, you may create a small helper launcher under .localapp/. Do not change business source files or install new dependencies.",
    "5. If the project already has a suitable icon, register icon. Otherwise, ask me at the end whether I want a generated .localapp/icon.png.",
    "6. After finishing, verify the JSON parses and report the start command, URL/port, and whether you created a helper launcher.",
    "",
    "Known AppShelf fields:",
    knownFields.length > 0 ? knownFields.join("\n") : "None yet; infer them from the current project."
  ].join("\n");
}

function normalizePathText(path?: string): string {
  return (path ?? "").replaceAll("\\", "/").toLowerCase();
}

function isHiddenManifest(registry: UserRegistry, app: AppRecord): boolean {
  if (!app.manifestPath) return false;
  const manifestPath = normalizePathText(app.manifestPath);
  return registry.hiddenManifestPaths.some((hiddenPath) => normalizePathText(hiddenPath) === manifestPath);
}

function findExistingApp(registry: UserRegistry, candidate: AppRecord): AppRecord | undefined {
  const projectPath = normalizePathText(candidate.projectPath);
  const manifestPath = normalizePathText(candidate.manifestPath);

  return registry.apps.find((app) => {
    if (app.id === candidate.id) return true;
    if (normalizePathText(app.projectPath) === projectPath) return true;
    return Boolean(manifestPath && normalizePathText(app.manifestPath) === manifestPath);
  });
}

function AppConfigDialog({
  app,
  t,
  onClose,
  onSaved
}: {
  app: AppRecord;
  t: (key: MessageKey) => string;
  onClose: () => void;
  onSaved: (registry: UserRegistry) => void;
}): React.JSX.Element {
  const [input, setInput] = useState<AppConfigInput>({
    id: app.id,
    name: app.name,
    description: app.description ?? "",
    iconPath: app.iconPath ?? "",
    command: app.command,
    url: app.url ?? "",
    port: app.port
  });

  async function save(): Promise<void> {
    const next = await window.appShelf.updateApp({
      ...input,
      description: input.description || undefined,
      iconPath: input.iconPath || undefined,
      url: input.url || undefined,
      port: input.port ? Number(input.port) : undefined
    });
    onSaved(next);
  }

  async function selectIcon(): Promise<void> {
    const iconPath = await window.appShelf.selectIconFile();
    if (iconPath) {
      setInput((current) => ({ ...current, iconPath }));
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="panel manual-panel">
        <PanelHead title={t("editApp")} onClose={onClose} />

        <label className="field">
          <span>{t("appName")}</span>
          <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
        </label>

        <label className="field">
          <span>{t("description")}</span>
          <input
            value={input.description}
            onChange={(event) => setInput({ ...input, description: event.target.value })}
          />
        </label>

        <label className="field">
          <span>{t("projectPath")}</span>
          <input value={app.projectPath} disabled />
        </label>

        <label className="field with-actions">
          <span>
            {t("iconPath")} <em>{t("optional")}</em>
          </span>
          <input
            value={input.iconPath}
            onChange={(event) => setInput({ ...input, iconPath: event.target.value })}
          />
          <button className="secondary-button" onClick={selectIcon}>
            {t("select")}
          </button>
          <button
            className="secondary-button"
            onClick={() => setInput((current) => ({ ...current, iconPath: "" }))}
            disabled={!input.iconPath}
          >
            {t("clear")}
          </button>
          <small>{t("iconPathHint")}</small>
        </label>

        <label className="field">
          <span>{t("command")}</span>
          <input value={input.command} onChange={(event) => setInput({ ...input, command: event.target.value })} />
        </label>

        <div className="two-cols">
          <label className="field">
            <span>{t("url")}</span>
            <input value={input.url} onChange={(event) => setInput({ ...input, url: event.target.value })} />
          </label>
          <label className="field">
            <span>{t("port")}</span>
            <input
              type="number"
              value={input.port ?? ""}
              onChange={(event) =>
                setInput({ ...input, port: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </label>
        </div>

        <div className="panel-actions">
          <button className="secondary-button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary-button" onClick={save} disabled={!input.name || !input.command}>
            {t("save")}
          </button>
        </div>
      </section>
    </div>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }): React.JSX.Element {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <button className="icon-button" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
}

function withStop(event: React.MouseEvent, action: () => void): void {
  event.stopPropagation();
  action();
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
