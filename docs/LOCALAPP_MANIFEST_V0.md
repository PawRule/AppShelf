# LocalApp Manifest v0 Reference

Status: Draft v0

` .localapp.json` is a local launch manifest for AppShelf. It tells AppShelf how to display and start one local web app.

It is not a deployment file, package manager file, or secret store.

## File Location

The manifest file name is:

```text
.localapp.json
```

Place it in the project root. The directory containing `.localapp.json` is the project root.

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
  "description": "A short description of the app.",
  "command": "npm run dev",
  "url": "http://localhost:5173",
  "port": 5173,
  "workingDirectory": "."
}
```

Add `icon` only when a suitable icon exists or the user asked for one:

```json
{
  "icon": ".localapp/icon.png"
}
```

## Field Reference

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `$schema` | No | string | Use `https://localapp.dev/schema/v0.json` when included. The URL is provisional. |
| `name` | Yes | string | Human-readable app name shown in AppShelf. |
| `description` | No | string | One short factual sentence. Avoid marketing copy. |
| `command` | Yes | string | Local command that starts the app from `workingDirectory`. |
| `url` | No | string | Browser URL AppShelf should open after startup. |
| `port` | No | number | Expected localhost port. Use a number, not a string. |
| `workingDirectory` | No | string | Directory where `command` runs. Defaults to `"."`. |
| `icon` | No | string | Project-relative icon path. Recommended generated path: `.localapp/icon.png`. |

## Path Rules

- `workingDirectory` is resolved relative to the project root.
- `icon` should be relative to the project root.
- Prefer relative paths over absolute machine-specific paths.
- Use absolute paths only when there is no practical alternative.
- `.` means the project root.

Examples:

```json
{
  "workingDirectory": "."
}
```

```json
{
  "workingDirectory": "frontend",
  "icon": ".localapp/icon.png"
}
```

## Command Rules

`command` should be exactly what a human would run to start the local web app.

Good examples:

```json
{ "command": "npm run dev" }
```

```json
{ "command": "pnpm dev" }
```

```json
{ "command": "python app.py" }
```

```json
{ "command": "streamlit run app.py" }
```

Do not put destructive, cleanup, reset, upload, or deployment commands in `.localapp.json`.

Do not include dependency installation commands unless the documented startup command truly requires them.

## Helper Launcher Rules

The default registration path should create or update only `.localapp.json`.

For simple static web apps with no existing local web server command, an agent may add a small helper launcher under `.localapp/`, for example:

```text
.localapp/server.js
```

This is an AppShelf launch adapter, not application business code.

Helper launchers are allowed only when they:

- stay inside `.localapp/`
- are small and easy to inspect
- use built-in runtime capabilities or already available dependencies
- do not modify business source files
- do not modify `package.json`, lockfiles, or project config
- do not install dependencies
- only serve or launch the local app for development

When a helper launcher is used, the manifest command may point to it:

```json
{
  "command": "node .localapp/server.js"
}
```

Agents must report helper launcher creation explicitly.

If a launcher would require complex logic, new dependencies, or source code changes, ask the user before proceeding.

## URL and Port Rules

Use `url` when the app has a known browser URL.

Use `port` when the app has a known expected localhost port.

When both exist, they should describe the same intended local app endpoint.

If `url` is missing and `port` exists, AppShelf may infer:

```text
http://localhost:<port>
```

If the port is uncertain, omit both `port` and `url` rather than guessing.

## Icon Rules

`icon` is optional.

Recommended generated icon path:

```text
.localapp/icon.png
```

Recommended generated icon properties:

- square PNG
- 512x512
- readable at small sizes
- no secrets or private user information
- no misleading third-party branding

Existing project icons may also be used, for example:

```json
{ "icon": "public/favicon.ico" }
```

```json
{ "icon": "public/icon.png" }
```

If no icon is available, omit `icon`. AppShelf will use a default icon or its built-in icon discovery.

## Security Rules

Do not store secrets in `.localapp.json`.

Never write:

- API keys
- tokens
- passwords
- private environment variable values
- local user credentials

AppShelf should ask before running a manifest command for the first time and ask again when the command changes.

## Agent Rules

When an AI agent writes `.localapp.json`:

- Fill `name` and `command`.
- Fill `description` only when it can be accurate.
- Fill `url` or `port` only when known with confidence.
- Prefer relative paths.
- Do not guess commands.
- Do not block basic registration on icon generation.
- If no icon exists, ask whether the user wants icon generation as a follow-up.

## Port Conflict Rule

The manifest should describe the app's intended local launch behavior.

Do not permanently change `.localapp.json` just because a port was temporarily occupied during one validation run.

For example, if a Next.js app is configured for port `3000`, keep `3000` even if a temporary dev server chose `3001` because `3000` was already busy.
