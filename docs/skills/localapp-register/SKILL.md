---
name: localapp-register
description: Register a local web app project for AppShelf by creating or updating .localapp.json. Use when the user asks to add AppShelf registration, register a project for AppShelf, make a local web app discoverable by AppShelf, or prepare an agent-generated web app for one-click launch in AppShelf.
---

# localapp-register

Use this skill to register the current local web app project for AppShelf.

## Required Reading

Read these project docs before writing files:

- `docs/AGENT_REGISTER_LOCALAPP.md`
- `docs/LOCALAPP_MANIFEST_V0.md` when exact field, path, icon, URL, or port rules are needed.

If this skill is copied into another project or chat, ask the user to provide those docs or paste their contents if they are not available.

## Workflow

1. Inspect the project before writing `.localapp.json`.
2. Determine the app name, startup command, working directory, and localhost URL or port when possible.
3. Create or update `.localapp.json` in the project root.
4. Validate the JSON.
5. Report the manifest path, command, URL or port, evidence used, and whether startup was verified.
6. If no suitable icon exists, ask whether the user wants icon generation or icon setup as a follow-up.

## Rules

- Do not invent a startup command.
- Do not guess a port when confidence is low.
- Do not store secrets in `.localapp.json`.
- Do not write destructive, reset, upload, deployment, or cleanup commands.
- Do not block basic registration on icon generation.
- Prefer `.localapp/icon.png` for generated icons.
- Omit `icon` when no suitable icon exists and the user did not ask for one.
- Do not permanently change the manifest just because a port was temporarily occupied during validation.
- Create a helper launcher such as `.localapp/server.js` only for simple static apps with no better start command, and only when it stays inside `.localapp/` without new dependencies or business source changes.

## Default Manifest Shape

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

Only include fields that are accurate.
