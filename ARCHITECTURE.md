# AppShelf Architecture

Status: Draft v0

## Technology Choice

MVP stack:

- Electron
- React
- TypeScript
- Vite

Reasoning:

- AppShelf needs native desktop behavior: process control, tray behavior, filesystem access, browser launching, and Explorer integration.
- Electron gives direct access to Node.js APIs in the main process, which keeps the MVP simpler than a Rust-backed desktop stack.
- React + Vite keeps the renderer fast to build and easy to iterate.

## Process Model

Electron has three main layers:

```text
main process
  owns filesystem access, registry persistence, process launching, logs, tray, dialogs

preload script
  exposes a small typed API to the renderer through contextBridge

renderer process
  owns React UI, app library, settings, drawer, commands triggered by the user
```

The renderer must not use unrestricted Node.js APIs directly.

## Major Modules

### Main Process

Location:

```text
src/main/index.ts
```

Responsibilities:

- create and manage the app window
- register IPC handlers
- load and save user registry
- scan configured folders
- start and stop apps
- open browser URLs
- open project folders in Explorer
- manage tray behavior

### Preload API

Location:

```text
src/preload/index.ts
```

Responsibilities:

- expose a safe `window.appShelf` API
- forward renderer requests to IPC
- subscribe to process log and status events

### Registry Store

Location:

```text
src/main/store.ts
```

Responsibilities:

- persist user settings
- persist app records discovered or manually added by the user
- persist trusted command hashes
- persist limited log history in a future version

MVP storage format:

```text
%APPDATA%\AppShelf\registry.json
```

This file stores local user preferences. It is separate from project `.localapp.json` files.

### App Library Rules

Location:

```text
src/main/appLibrary.ts
```

Responsibilities:

- find and update app records in the user registry
- normalize paths for local registry comparisons
- decide whether an app is active enough to block removal
- merge scanned manifest apps with local user state
- hide scanned apps by manifest path when removed from the library
- restore hidden manifest apps
- remove apps discovered under a removed scan folder

This module should stay independent of Electron IPC, dialogs, browser opening, and the concrete process manager implementation. Runtime process state is passed in through a small `isProcessRunning` callback.

### Manifest Scanner

Location:

```text
src/main/manifest.ts
```

Responsibilities:

- read `.localapp.json`
- validate required fields
- normalize relative paths
- infer URL from port when URL is missing
- find default icons when `icon` is missing
- scan only user-approved folders

MVP scanner behavior:

- find `.localapp.json` in configured scan folders
- avoid scanning the whole computer
- keep recursion shallow enough to avoid expensive scans

### Process Manager

Location:

```text
src/main/processManager.ts
```

Responsibilities:

- start app commands
- capture stdout and stderr
- track process status
- emit logs to renderer
- detect known port conflicts before startup
- stop app processes

MVP process behavior:

- run commands through `cmd.exe /d /s /c` on Windows
- run inside the app working directory
- track the spawned process PID
- attempt process tree cleanup on stop
- mark apps as failed when the process exits during startup

Windows process cleanup is the highest technical risk. The initial implementation may use `taskkill /PID <pid> /T /F` as a pragmatic MVP. A more robust version should investigate Windows Job Objects.

### URL Health Check

Location:

```text
src/main/health.ts
```

Responsibilities:

- check whether a known URL responds
- retry for a short startup window
- distinguish process-running from URL-reachable

MVP readiness:

- if `url` exists, poll it
- else if `port` exists, poll `http://localhost:<port>`
- else fall back to process state

## Data Model

### LocalAppManifest

Matches `SPEC.md` v0:

```ts
type LocalAppManifest = {
  $schema?: string;
  name: string;
  description?: string;
  icon?: string;
  command: string;
  url?: string;
  port?: number;
  workingDirectory?: string;
};
```

### AppRecord

Internal desktop app model:

```ts
type AppRecord = {
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
  status: "stopped" | "starting" | "running" | "external" | "unreachable" | "failed";
  processId?: number;
  externalProcessIds?: number[];
  trustedCommandHash?: string;
  lastErrorSummary?: string;
};
```

### UserRegistry

```ts
type UserRegistry = {
  version: 0;
  settings: {
    language: "zh" | "en";
    viewMode: "cards" | "list";
    autoOpenBrowser: boolean;
    closeBehavior: "ask" | "tray" | "exit";
    scanFolders: string[];
  };
  apps: AppRecord[];
  hiddenManifestPaths: string[];
  lastScan?: {
    scannedAt: number;
    discoveredCount: number;
    diagnostics: ScanDiagnostic[];
  };
};
```

## IPC Surface

Renderer-to-main:

- `registry:get`
- `settings:update`
- `dialog:selectFolder`
- `dialog:selectIconFile`
- `scan:addFolder`
- `scan:removeFolder`
- `scan:run`
- `app:createManual`
- `app:update`
- `app:start`
- `app:stop`
- `app:restart`
- `app:openUrl`
- `app:openFolder`
- `app:remove`
- `app:restoreHiddenManifest`

Main-to-renderer events:

- `app:status`
- `app:log`
- `scan:complete`

## Startup Flow

```text
user clicks Start
  renderer calls app:start
  main checks app record
  main checks command trust
  main checks known port conflict
  process manager spawns command
  logs stream to renderer
  health check waits for URL if available
  status becomes Running or Open Failed / Start Failed
  browser opens if global setting is enabled
```

## Stop Flow

```text
user clicks Stop
  renderer calls app:stop
  process manager attempts graceful stop
  if process remains, kill process tree
  status becomes Stopped
```

MVP may use forced process tree termination because many dev servers do not exit cleanly from detached shell commands.

## Security Model

`.localapp.json` contains executable instructions.

MVP protections:

- scan only user-approved folders
- show command before first run
- store trusted command hash after confirmation
- ask again when command changes
- keep manifest path visible
- never store secrets in the manifest
- never upload logs automatically

## UI Architecture

Renderer structure:

```text
src/renderer/src/
  main.tsx
  styles.css
  i18n.ts
  global.d.ts
  assets.d.ts
  assets/
```

The renderer is currently concentrated in `main.tsx`. Phase 4 architecture hardening should review whether the renderer should be split into deeper component modules before larger features are added.

MVP UI:

- app shell with top toolbar
- card/list view toggle
- app library
- right detail drawer
- settings panel
- manual registration form

## Known Tradeoffs

- `taskkill` is practical for MVP but not as clean as Windows Job Objects.
- Shell command strings are flexible but require user trust.
- Readiness checks can fail for apps that require longer compilation time.
- Manual registration is more reliable than automatic framework guessing, so guessing should wait until after the core flow works.

## Implementation Order

1. Create Electron + React project skeleton.
2. Add registry persistence.
3. Add manifest scanning.
4. Add manual app registration.
5. Add process start/stop/log streaming.
6. Add URL health check.
7. Add UI card view and detail drawer.
8. Add settings and i18n.
9. Add command trust confirmation.
10. Add tray behavior.
