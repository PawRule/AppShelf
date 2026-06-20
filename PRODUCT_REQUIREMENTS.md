# AppShelf Product Requirements

Status: Draft v0

## Product Vision

AppShelf is a Windows desktop app for managing localhost projects through a visual library.

The user should not need to remember startup commands, open terminals, or ask an AI agent to start a project manually. They should be able to open AppShelf, find a project, click Start, and use it in the browser.

The project can be a web app, personal site, blog, docs site, dashboard, game, demo, or local tool. AppShelf's concern is the local launch experience, not the category label.

The product should feel closer to an app library than an IDE.

## Primary User

The first user is the project owner.

Future users may include AI-heavy developers and non-programmers who use agents to create localhost projects.

## Core Problem

AI agents can cheaply create many localhost projects, but managing them afterward is inconvenient:

- startup commands are scattered across README files, package scripts, chat history, or memory
- projects may live in different folders
- opening a terminal for every project is tedious
- stopping projects cleanly can be unreliable
- failed starts require digging through logs

AppShelf centralizes discovery, launching, stopping, and basic app metadata.

## Product Principles

- One-click start is the primary value.
- The UI should be understandable without command-line knowledge.
- The first version should be useful before any ecosystem or standard exists.
- `.localapp.json` is a helper contract, not a blocker.
- The app should tolerate incomplete metadata.
- Keep advanced orchestration out of v0.

## MVP Scope

### Required

- Windows desktop app.
- Add one or more user-approved scan folders.
- Scan those folders for `.localapp.json`.
- Allow manual app registration when no manifest exists.
- Create or update `.localapp.json` when registering an app manually.
- Keep a local user registry for app library state and settings.
- Display apps in card view and list view.
- Show app name, icon, description, status, and URL.
- Start an app with one click.
- Stop an app with one click.
- Restart an app.
- Open the app URL in the browser.
- Open the app folder in the file explorer.
- Show logs in a right-side detail drawer.
- Show a simple error summary when startup fails.
- Copy error summary and logs.
- Detect port conflict when `port` is known.
- Default to opening the browser automatically after successful startup.
- Provide a global setting to disable auto-opening the browser.
- Provide Chinese and English UI language options.
- Ask whether to exit or hide to tray when closing the window.
- Edit app configuration after registration.
- Distinguish apps started by AppShelf from apps already running externally.

### Explicitly Out of Scope for MVP

- Docker Compose support.
- Package manager or runtime installation.
- Git branch/status integration.
- Built-in terminal.
- Multi-service orchestration.
- AI automatic repair.
- Agent control plane.
- Secret management.
- Cloud sync.
- Remote server management.
- Cross-platform support beyond Windows.
- App preview screenshots.
- Batch launch groups.
- Workspaces.
- Automatic port rewriting.

## App Discovery

The app must not scan the whole computer.

Users configure scan folders, such as:

```text
D:\AI-Apps
D:\Projects
D:\Projects
```

MVP discovery behavior:

1. Scan only user-approved folders.
2. Discover apps with `.localapp.json`.
3. Show discovered apps in the app library.
4. Allow manual refresh.
5. Optionally refresh on app startup.

Future discovery behavior:

- Detect likely localhost projects without `.localapp.json`.
- Put likely projects into an "Unregistered" area.
- Let the user register them from the UI.

## Manual Registration

If a project has no `.localapp.json`, the user can register it manually.

Required fields:

- app folder
- app name
- startup command

Optional fields:

- description
- icon
- URL
- port

Default behavior:

- Write `.localapp.json` into the project folder when possible.
- Also store the app in the local user registry.
- If the project folder is not writable, store registration only in the user registry.

The UI should expose this distinction clearly.

## Views

### Card View

Card view is the default library experience.

Each card should include:

- icon
- app name
- short description
- status
- primary Start or Stop button
- secondary actions

Cards must include both icon and text. They should not be icon-only.

### List View

List view is for denser management.

Each row should include:

- icon
- app name
- status
- URL
- command
- actions

## App Detail Drawer

Selecting an app opens a right-side drawer.

The drawer should show:

- app name
- icon
- description
- manifest path
- project path
- startup command
- URL
- port
- current status
- recent logs
- error summary when relevant

Primary actions:

- Start
- Stop
- Restart
- Open
- Edit Config
- Open Folder
- Copy Logs
- Copy Error

## Status Model

The UI should be simple, but the app should internally distinguish process state from browser accessibility.

User-facing statuses:

- Stopped
- Starting
- Running
- External Running
- Open Failed
- Start Failed

Running should ideally mean the URL is reachable.

If no URL or port is known, running can fall back to process state, but the UI should make it clear that accessibility was not verified.

External Running means the configured URL is reachable, but AppShelf did not start or does not own the process. Stopping an externally running app requires explicit user confirmation and should be based on a known port.

## Port Conflicts

If two registered apps use the same port, starting them one at a time is allowed.

If app A is running on a port and the user starts app B with the same configured port, AppShelf should:

1. Detect that the port or URL is already active.
2. Avoid silently changing app B's port.
3. Tell the user which port is occupied.
4. Let the user stop the currently running app when safe and explicitly confirmed.
5. Start app B only after the port is available.

AppShelf should not edit commands, inject environment variables, or automatically choose a new port in v0. Many frameworks support dynamic ports, but the resulting URL may no longer match `.localapp.json`, and some apps cannot safely switch ports without code or config changes.

Future versions may support per-app port override only when the manifest or project clearly declares how to override the port.

## App Icons

App cards and list rows should remain readable without custom icons, but icon support is important for a library-style experience.

Recommended project icon path:

```text
.localapp/icon.png
```

Expected behavior:

- If `.localapp.json` specifies `icon`, use it.
- Else try `.localapp/icon.png`.
- Else try common favicon or logo paths.
- Else use the built-in default letter icon.

Agent workflow:

- If the agent has image generation capability, it may generate a square app icon and save it as `.localapp/icon.png`.
- If the agent lacks image generation capability, it should omit the icon and let AppShelf use the default.
- The user can later edit the icon path in AppShelf.

## Logs

MVP should show logs in the app detail drawer.

Recommended behavior:

- Capture stdout and stderr.
- Show current-session logs.
- Store limited recent logs locally.
- Keep the last 20 runs per app.
- Cap each run log at 2 MB.
- Allow copying logs.
- Allow clearing local log history.

Startup failure summary for MVP can be based on the last 30 log lines.

## Settings

MVP settings:

- scan folders
- UI language: Chinese or English
- view mode: card or list
- automatically open browser after successful startup
- close behavior: ask, minimize to tray, or exit
- default browser behavior through the operating system

## Agent-Friendly Workflow

The preferred agent workflow is:

1. User asks an agent to create or modify a localhost project.
2. Agent writes or updates `.localapp.json`.
3. If image generation is available, the agent may create `.localapp/icon.png` and reference it from the manifest.
4. AppShelf scans the configured folder.
5. The app appears in the GUI.
6. User starts it from AppShelf.

Agents should not need to call a AppShelf API in v0.

Future enhancements may include:

- a `localapp` CLI
- a Codex skill
- editor rules for Cursor or Claude Code
- startup failure handoff to an agent

## Security Requirements

Because AppShelf executes local commands, MVP must include basic trust controls.

Required:

- Only scan folders explicitly added by the user.
- Show the command before the first run.
- Ask for confirmation before first run.
- Ask for confirmation again if the command changes.
- Never store secrets in `.localapp.json`.
- Never upload logs automatically.
- Make the manifest path visible.

Recommended:

- Mark apps whose commands changed since last confirmation.
- Store a hash of the trusted command in the user registry.
- Warn when a command appears unusually risky.

## Technical Direction

Preferred MVP direction:

- Desktop app first.
- Windows first.
- Electron is preferred for MVP because process management, shell command execution, browser opening, and filesystem access are central to the product.

The most important technical risk is reliable process cleanup on Windows. Many dev commands spawn child processes, and stopping only the parent process may leave ports occupied.

The implementation should investigate one of:

- Windows Job Objects
- process tree tracking and recursive termination
- a mature Node.js process management package that handles Windows child processes reliably

## Major Risks

### Process Cleanup

If Stop does not reliably stop the app and its child processes, the core product promise is weakened.

### Command Trust

`.localapp.json` can contain arbitrary commands. The app must treat manifests as executable instructions that require user trust.

### Incorrect Readiness

A process can be alive while the web page is unavailable. The app should check URL accessibility when possible.

### Manifest Drift

The manifest can become outdated if startup commands change. Manual editing and agent updates must remain easy.

### Scope Creep

The product can easily grow into a local platform, agent control plane, package manager, or Docker alternative. MVP should stay focused on one-click localhost project launching.

## Open Product Questions

- Should the app include an "Unregistered Projects" section in MVP or v1?
- Should manual registration always prefer writing `.localapp.json`, or should "local only" be more prominent?
- Should future versions support multiple run profiles?
- Should future versions support app screenshots?
- Should startup failure summaries remain log-based or eventually use an AI agent handoff?
- Should the project publish the manifest spec before or after the app is usable?
- Should v1 define a safe, explicit port override mechanism?
- Should AppShelf support drag-and-drop icon upload, or is path selection enough for v1?
