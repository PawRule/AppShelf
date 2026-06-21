# Public Release Checklist

Status: draft v0

This checklist prepares the private AppShelf repository for a future public release. It does not mean the project is ready to publish today.

## Required Before Public Release

- [x] README describes positioning, setup, current limitations, safety model, and `.localapp.json`.
- [x] LICENSE is present and matches `package.json`.
- [x] `.gitignore` excludes dependencies, build output, environment files, logs, and local AppShelf registry data.
- [x] Issue templates are present.
- [x] Security notes are present.
- [ ] Public screenshots use sample apps only.
- [x] No private local paths, tokens, real user data, or private project names appear in committed public screenshots.
- [x] No `.env`, registry, log, credential, or token files are committed.
- [ ] Build and typecheck pass.

## Screenshot Policy

Public screenshots should use only example apps or deliberately sanitized demos.

Avoid showing:

- private project names
- user names
- absolute local paths that identify the user or machine
- terminal output containing secrets
- browser pages containing private data
- API keys, tokens, session IDs, cookies, or credentials

Preferred screenshot source:

- `examples/hello-localapp`
- synthetic demo projects created only for documentation

Do not commit internal design screenshots unless they are deliberately sanitized. Regenerate public screenshots before publishing the repository or using screenshots in a public README.

## Secrets Audit

Before public release, run a source-only scan that excludes dependencies and build output:

```powershell
rg -n -i "(token|secret|password|api[_-]?key|access[_-]?token|private key|authorization|bearer|github_pat|sk-|aiza|akia)" --glob "!node_modules/**" --glob "!out/**" --glob "!package-lock.json" .
```

Manual review is still required. Automated search can miss secrets and can produce false positives.

## Phase 8 Review Notes

- The committed example project is intentional: `examples/hello-localapp`.
- No real user test project, user registry, `.env`, log, credential, or token file is committed.
- Stale internal design screenshots were removed from the repository. Public screenshots should be regenerated from sample projects.
- Remaining `webAppStarter` references are historical task notes or the legacy registry migration path.
- Current source structure is acceptable for a first public repository: Electron bootstrap stays in `src/main/index.ts`, app library behavior lives in `src/main/appLibrary.ts`, registry persistence is isolated in `src/main/store.ts`, process handling is isolated in `src/main/processManager.ts`, shared contracts live in `src/shared/types.ts`, and the renderer remains the main area to split only when future UI work justifies it.
- The repository is source-ready after build/typecheck pass, but release readiness still depends on the packaging decision.

## Release Notes Checklist

Each release note should include:

- supported OS
- whether packaged installers exist
- known limitations
- migration notes for `.localapp.json` or registry changes
- security reminders for executable commands
