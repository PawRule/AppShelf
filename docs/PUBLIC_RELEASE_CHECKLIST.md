# Public Release Checklist

Status: draft v0

This checklist prepares the private AppShelf repository for a future public release. It does not mean the project is ready to publish today.

## Required Before Public Release

- [ ] README describes positioning, setup, current limitations, safety model, and `.localapp.json`.
- [ ] LICENSE is present and matches `package.json`.
- [ ] `.gitignore` excludes dependencies, build output, environment files, logs, and local AppShelf registry data.
- [ ] Issue templates are present.
- [ ] Security notes are present.
- [ ] Screenshots use sample apps only.
- [ ] No private local paths, tokens, real user data, or private project names appear in screenshots intended for public docs.
- [ ] No `.env`, registry, log, credential, or token files are committed.
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

Current internal design screenshots under `docs/design/` are not automatically public-ready:

- `docs/design/current-renderer.png` shows a local development path.
- `docs/design/main-screen-concept.png` uses the old webAppStarter name and example local user paths.

Regenerate public screenshots before publishing the repository or using screenshots in a public README.

## Secrets Audit

Before public release, run a source-only scan that excludes dependencies and build output:

```powershell
rg -n -i "(token|secret|password|api[_-]?key|access[_-]?token|private key|authorization|bearer|github_pat|sk-|aiza|akia)" --glob "!node_modules/**" --glob "!out/**" --glob "!package-lock.json" .
```

Manual review is still required. Automated search can miss secrets and can produce false positives.

## Release Notes Checklist

Each release note should include:

- supported OS
- whether packaged installers exist
- known limitations
- migration notes for `.localapp.json` or registry changes
- security reminders for executable commands
