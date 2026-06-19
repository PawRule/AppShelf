# AppShelf Local App Manifest Spec

Status: Draft v0

This document defines the first version of the `.localapp.json` manifest used by AppShelf. The goal is not to create a full deployment format. The goal is to give humans, the desktop app, and AI agents a small, predictable file that answers one question:

How do I start this local web app?

For the concise field reference used by agents and contributors, see `docs/LOCALAPP_MANIFEST_V0.md`.

## Goals

- Provide a technology-agnostic way to describe a local web app.
- Let AI agents register generated apps by writing one manifest file.
- Let AppShelf discover apps inside user-approved scan folders.
- Avoid requiring users to remember terminal commands.
- Keep the first version small enough to be written by hand.

## Non-Goals

- Replacing `package.json`, `pyproject.toml`, Docker Compose, or README files.
- Managing production deployments.
- Managing remote servers.
- Defining a full multi-service orchestration standard.
- Storing secrets, tokens, or private credentials.
- Requiring app projects to use Node.js.

## File Location

The manifest file must be named:

```text
.localapp.json
```

It should be placed in the root directory of the web app project.

The directory containing `.localapp.json` is treated as the project root unless `workingDirectory` is provided.

## Minimal Manifest

```json
{
  "name": "My Web App",
  "command": "npm run dev"
}
```

## Recommended Manifest

```json
{
  "$schema": "https://localapp.dev/schema/v0.json",
  "name": "My Web App",
  "description": "A short description of the app",
  "icon": ".localapp/icon.png",
  "command": "npm run dev",
  "url": "http://localhost:5173",
  "port": 5173,
  "workingDirectory": "."
}
```

## Fields

### `$schema`

Optional string.

URL of the JSON Schema for editor validation. The v0 schema URL is provisional:

```text
https://localapp.dev/schema/v0.json
```

### `name`

Required string.

Human-readable app name displayed in the AppShelf UI.

### `description`

Optional string.

Short app description displayed in the UI.

### `icon`

Optional string.

Relative path from the project root to an app icon.

Recommended path:

```text
.localapp/icon.png
```

Recommended image properties:

- square PNG
- 512x512 when generated specifically for AppShelf
- visually readable at small sizes
- no secrets, private user information, or misleading third-party branding

Recommended formats:

- `.ico`
- `.png`
- `.jpg`
- `.svg`

If omitted, AppShelf should try common icon paths before falling back to a default icon.

Icon discovery order:

1. `icon` from `.localapp.json`
2. `.localapp/icon.png`
3. `public/favicon.ico`
4. `public/icon.png`
5. Files containing `logo` under common asset folders
6. Built-in default icon

Agents with image generation capability may create `.localapp/icon.png` and reference it from the manifest. Agents without image generation capability should omit `icon` unless an existing suitable project icon is already present.

### `command`

Required string.

Command used to start the app locally.

Examples:

```json
{
  "command": "npm run dev"
}
```

```json
{
  "command": "python app.py"
}
```

```json
{
  "command": "streamlit run app.py"
}
```

For v0, `command` is a string instead of an array. This keeps the format simple and compatible with real-world commands that rely on shell behavior.

### `url`

Optional string.

Preferred browser URL after the app starts.

Example:

```json
{
  "url": "http://localhost:3000"
}
```

If `url` is missing but `port` is present, AppShelf may infer:

```text
http://localhost:<port>
```

### `port`

Optional number.

Expected localhost port.

This is used for:

- port conflict checks
- startup readiness checks
- URL inference
- status display

`port` is advisory. If the actual app starts on a different port, the UI should report that clearly instead of silently pretending the manifest is correct.

### `workingDirectory`

Optional string.

Relative path from the manifest directory where the command should run.

Default:

```text
.
```

## Execution Model

For v0 on Windows:

- Commands are executed from `workingDirectory`.
- Commands are executed through the system shell.
- AppShelf captures stdout and stderr.
- AppShelf tracks the started process.
- AppShelf should attempt to stop child processes when stopping an app.

The exact process management implementation is part of the desktop app, not the manifest spec.

## Port Conflict Behavior

`port` is an expected default port, not a promise that the app can always bind to it.

When the user starts an app and the configured URL or port is already reachable, AppShelf should treat the app as externally running instead of starting a duplicate process.

When another app is already using the configured port and the target URL is not the expected app, AppShelf should warn the user instead of silently switching ports.

For v0, AppShelf should not automatically change ports by editing commands or environment variables. Automatic port switching is only valid in a future version if the app explicitly supports a safe port override mechanism.

## Status Detection

AppShelf should treat app status as a combination of process state and URL accessibility.

Internal states may include:

- `stopped`
- `starting`
- `running`
- `external`
- `unreachable`
- `failed`

For the user, the UI can simplify these into:

- Stopped
- Starting
- Running
- External Running
- Open Failed
- Start Failed

Readiness check priority:

1. If `url` exists, check whether the URL can be opened.
2. Else if `port` exists, check `http://localhost:<port>`.
3. Else fall back to process state and logs.

## Agent Registration Contract

An AI agent registers an app by creating or updating `.localapp.json` in the project root.

The agent should:

- Use English field names.
- Fill at least `name` and `command`.
- Fill `description` when it can do so accurately.
- Fill `url` or `port` when known.
- Prefer `.localapp/icon.png` for generated app icons.
- Avoid storing secrets.
- Prefer project-relative icon paths.
- Avoid writing machine-specific absolute paths unless there is no practical alternative.

The agent does not need to directly modify the AppShelf user registry.

## Desktop App Registry

The desktop app may keep a separate user-level registry for local preferences and UI state.

Examples:

- scan folders
- layout preference
- language preference
- auto-open-browser setting
- close-to-tray setting
- app sorting and grouping
- trust confirmations
- recent logs
- locally hidden apps that should not be shown even if their `.localapp.json` remains inside a scan folder

The project manifest describes how to run the app. The user registry describes how this user wants to manage it.

## Removing Apps From AppShelf

Removing an app from AppShelf is a library action, not a filesystem delete action.

For v0:

- AppShelf must not delete the project directory when the user removes an app.
- AppShelf must not delete `.localapp.json` as part of the default remove action.
- Manually registered local-only apps can be removed from the user registry.
- Apps discovered from scan folders should be hidden locally by manifest path so future scans do not immediately add them back.
- Hidden scanned apps should be restorable from AppShelf settings.
- If an app is running, AppShelf should ask the user to stop it before removing it from the library.

Dangerous actions such as deleting `.localapp.json` or deleting the project directory are out of scope for v0 and should require a separate secondary menu plus explicit confirmation if added later.

## Security Rules

`.localapp.json` can contain arbitrary commands. AppShelf must not blindly execute manifests from unknown locations.

Recommended v0 behavior:

- Only scan user-approved folders.
- Require confirmation before running an app for the first time.
- Require confirmation again if the manifest command changes.
- Show the command before first execution.
- Mark the manifest path in the app detail panel.
- Do not store secrets in `.localapp.json`.
- Do not upload logs automatically.

## Open Questions

- Should v1 support multiple commands such as `install`, `dev`, `build`, and `test`?
- Should v1 support multiple profiles such as `dev`, `demo`, and `test`?
- Should the manifest support environment variables, or should this remain outside the spec?
- Should readiness checks support health URLs beyond the main app URL?
- Should a future CLI exist, such as `localapp register`, `localapp run`, and `localapp doctor`?
- Should there be a `.localapp.local.json` for machine-specific overrides?

## Future Work

### Smart Registration

AppShelf may later support smart registration from a selected project folder.

The intended flow would be:

1. Infer one or more candidate launch commands from common project files.
2. Show the candidate command, URL, port, and manifest preview to the user.
3. Run a user-approved test launch.
4. Write `.localapp.json` only after the user confirms the result.

This is intentionally deferred. Manual registration and agent-written `.localapp.json` remain the primary v0 registration paths.
