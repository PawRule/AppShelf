# Register a Project for AppShelf

This guide is for an AI coding agent working inside a local web app project.

Your task is to register the current project so it can be discovered and launched by **AppShelf**.

For exact manifest fields and path rules, see:

```text
docs/LOCALAPP_MANIFEST_V0.md
```

If your agent supports skill-style instructions, you can also reference:

```text
docs/skills/localapp-register/SKILL.md
```

## What AppShelf Is

AppShelf is a Windows desktop app for managing local localhost web apps from a GUI.

It lets the user:

- see local web apps in one app library
- start an app without remembering terminal commands
- stop or restart the app
- open the localhost URL in a browser
- view logs and copy startup errors

AppShelf discovers projects by scanning user-approved folders for:

```text
.localapp.json
```

## Your Goal

Create or update `.localapp.json` in the project root so AppShelf can discover and launch the app.

The manifest must answer:

1. What is this app called?
2. How should AppShelf start it?
3. What localhost URL or port should the user open, if known?
4. Where should the command run?

Do the basic registration first. Do not delay `.localapp.json` creation just because a custom icon is missing.

## Default Workflow

When the user asks you to "register this app for AppShelf" or "add AppShelf registration":

1. Inspect the project.
2. Determine the app name, start command, working directory, and localhost URL or port when possible.
3. Create or update `.localapp.json`.
4. Validate that the JSON is valid.
5. Report what you wrote and what evidence you used.
6. If no suitable icon already exists, ask whether the user wants you to generate or add an AppShelf icon as a follow-up.

Do not make icon generation part of the default blocking registration path.

If the user explicitly asks for an icon in the same request, you may create the icon during the same task if you have the required capability. Otherwise, finish the manifest first and explain what remains.

## Inspect Before Writing

Check likely sources such as:

- `package.json`
- `README.md`
- framework config files
- existing scripts
- existing docs
- project file structure

Do not invent a startup command.

If the startup command is unclear, report that clearly instead of guessing.

## Helper Launcher Policy

Default to creating or updating only `.localapp.json`.

If the project has no existing local web server command, but it is a simple static web app, you may create a small helper launcher under `.localapp/`.

Allowed example:

```text
.localapp/server.js
```

Use a helper launcher only when all of these are true:

- the project has no clearer documented start command
- the helper is small and only serves the local project for development
- the helper does not require new dependencies
- the helper does not modify business source files
- the helper does not modify `package.json`, lockfiles, or project config
- the helper stays inside `.localapp/`

If you create a helper launcher, state that clearly in your final response.

Do not create a helper launcher if it would require a complex server, dependency installation, build pipeline changes, or edits to the app's main source code. Ask the user first instead.

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

Include `icon` only when an icon exists or the user asked you to create one.

Recommended generated icon path:

```text
.localapp/icon.png
```

## How to Determine the Startup Command

For Node projects:

1. Read `package.json`.
2. Prefer a script named `dev`.
3. If no `dev` exists, look for `start`.
4. Use the package manager that the project already uses:
   - `pnpm-lock.yaml` means prefer `pnpm`
   - `yarn.lock` means prefer `yarn`
   - `package-lock.json` means prefer `npm`
   - `bun.lockb` or `bun.lock` means prefer `bun`

Examples:

```json
{ "command": "pnpm dev" }
```

```json
{ "command": "npm run dev" }
```

For Python projects:

1. Check README and project docs first.
2. Check common entry files such as `app.py`, `main.py`, or framework-specific files.
3. Use documented commands when available.

Examples:

```json
{ "command": "python app.py" }
```

```json
{ "command": "uvicorn main:app --reload" }
```

```json
{ "command": "streamlit run app.py" }
```

## How to Determine the Port

Prefer explicit project evidence:

- startup script includes a port
- framework config specifies a port
- README states a localhost URL
- environment example includes `PORT`
- existing app code listens on a fixed port

Common defaults may be used only when confidence is high:

- Vite: `5173`
- Next.js: `3000`
- Create React App: `3000`
- Astro: `4321`
- SvelteKit: `5173`
- Vue/Vite: `5173`
- Flask: `5000`
- FastAPI/Uvicorn: `8000`
- Streamlit: `8501`

If the port is uncertain, omit `port` and `url`.

Do not permanently change the manifest because a port was temporarily occupied during one validation run.

## Security Rules

Do not store secrets in `.localapp.json`.

Do not write:

- API keys
- tokens
- passwords
- private environment variable values
- local user credentials

Do not make the startup command destructive.

Avoid commands that delete, overwrite, reset, upload, or deploy data.

## Validation

After writing `.localapp.json`, verify that the JSON is valid.

If practical, run the startup command long enough to confirm the app starts.

If running the command requires installing dependencies, network access, secrets, or other user approval, do not proceed silently. Explain what is needed.

At the end, report:

- the path of `.localapp.json`
- the chosen startup command
- the chosen URL or port, if any
- what evidence you used
- whether you verified startup
- whether an icon was reused, generated, or intentionally omitted
- whether a helper launcher such as `.localapp/server.js` was created

If the manifest was created successfully and no custom icon was added, ask the user whether they want icon generation or icon setup as a separate follow-up. Keep this question short.

## Example Follow-Up Question

```text
I registered the app for AppShelf. No custom AppShelf icon was added. Do you want me to generate or add one at .localapp/icon.png?
```

## Important Reminder

The manifest is not a deployment config.

It is only a local launch manifest for AppShelf.

Keep it small, accurate, and boring.
