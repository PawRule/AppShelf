# AppShelf Tasks

Status: Phase 8 tasks 1-3 complete; packaging decision pending.

## MVP Baseline

### Project Skeleton

- [x] Create Electron + React + TypeScript + Vite project files.
- [x] Add scripts for development, build, typecheck, and lint where practical.
- [x] Create main process, preload, and renderer entry points.
- [x] Open a desktop window with the React UI.

### Local Data

- [x] Define shared types for manifest, app records, settings, and logs.
- [x] Implement registry load/save at `%APPDATA%\AppShelf\registry.json`.
- [x] Add default settings.
- [x] Add IPC endpoint to read registry.
- [x] Add IPC endpoint to update settings.

### Manifest and Registration

- [x] Implement `.localapp.json` reader.
- [x] Normalize relative paths.
- [x] Infer URL from port when URL is missing.
- [x] Scan user-approved folders for manifests.
- [x] Add manual app registration.
- [x] Write `.localapp.json` during manual registration when possible.
- [x] Store local-only records when manifest writing fails.

### Process Management

- [x] Start apps through Windows shell.
- [x] Capture stdout and stderr.
- [x] Stream logs to the renderer.
- [x] Track app status.
- [x] Stop apps with process tree cleanup.
- [x] Detect known port conflicts.
- [x] Summarize startup errors from recent logs.

### Health and Browser

- [x] Poll URL after startup when URL or port is known.
- [x] Mark app as running only when reachable when possible.
- [x] Open browser after successful startup when enabled.
- [x] Add manual Open URL action.

### UI

- [x] Build app shell and toolbar.
- [x] Build card view.
- [x] Build list view.
- [x] Build right detail drawer.
- [x] Build settings panel.
- [x] Build manual registration form.
- [x] Build app config editing form.
- [x] Add Chinese and English UI strings.
- [x] Add empty states.
- [x] Add error and log copy buttons.

### Trust and Safety

- [x] Show command before first run.
- [x] Store trusted command hash.
- [x] Ask again when command changes.
- [x] Show manifest path in detail drawer.
- [x] Add warning copy for commands from manifest files.

### Desktop Behavior

- [x] Add tray support.
- [x] Ask whether closing means exit or hide to tray.
- [x] Add Open Folder action through Explorer.
- [x] Persist window-safe user settings.
- [x] Hide the native Electron menu bar for a cleaner launcher-style window.

### Verification Backlog

- [x] Create sample app manifest for local testing.
- [ ] Verify start, stop, restart, logs, open URL.
- [ ] Verify failed command handling.
- [ ] Verify port conflict handling.
- [x] Verify card/list switching.
- [x] Verify Chinese/English switching.

## Phase 2: Daily-Use Polish

- [x] Rename the app from webAppStarter to AppShelf.
- [x] Replace the default Electron app icon.
- [x] Set window and tray icons.
- [x] Set the in-app brand icon.
- [x] Define and document `.localapp/icon.png` as the recommended app icon path.
- [x] Improve app icon discovery to prefer `.localapp/icon.png`.
- [x] Add scan folder removal.
- [x] Improve scan folder list scrolling and long path display.
- [x] Add safe app removal from the AppShelf library without deleting project files.
- [x] Mark required and optional fields in manual registration.
- [x] Add lightweight scan feedback for empty folders and invalid manifests.
- [x] Show clearer port conflict messaging before start.
- [x] Show PID details for running and external-running apps when available.

## Phase 3: Product Direction and Release Preparation

- [x] Research similar local app launchers, process managers, developer dashboards, and game-library style app shelves.
- [x] Compare registration approaches: `.localapp.json`, README instructions, package scripts, Procfile-like files, VS Code tasks, and Docker Compose.
- [x] Identify which ideas are worth borrowing and which are outside AppShelf's scope.
- [x] Revisit whether `.localapp.json` should remain a private AppShelf convention or become a published lightweight spec.
- [x] Decide whether v1 needs explicit port override support, and define the safe behavior if it does.
- [x] Define Git repo import flow: paste repo URL, choose destination folder, clone, scan/register, and avoid automatic command execution until trusted.
- [x] Decide whether Git repo import belongs in v1 or should wait until after core local-library behavior is stronger.
- [x] Prepare private repository hygiene for future public release: README, license decision, `.gitignore`, screenshots policy, issue templates, and secrets audit.
- [x] Define the `localapp-register` skill scope while keeping the agent registration guide agent-agnostic for Codex, opencode, and other agents.
- [x] Define app icon registration guidance: prefer `.localapp/icon.png`, allow generated PNG icons, allow SVG fallback when image generation is unavailable.
- [x] Decide whether generated icons belong in the future skill, the agent guide, or both.
- [x] Define removed-app recovery UX: rename hidden apps to removed apps, explain restore path in remove confirmation, and detect restore opportunities when manually adding a hidden app again.

## Phase 4: Architecture Hardening

- [x] Perform a code architecture review with emphasis on deep modules and stable module boundaries.
- [x] Document current architecture in `ARCHITECTURE_REVIEW.md`: main process, preload, renderer, registry, manifest, scanning, process lifecycle, and IPC boundaries.
- [x] Identify shallow modules or overly broad modules that expose too much internal detail.
- [x] Review whether Electron main process responsibilities should be split into services such as AppLibraryService, ScanService, RegistryService, CommandTrustService, and future ImportService.
- [x] Review data model boundaries between manifest data, user registry data, runtime process state, scan diagnostics, and UI-only state.
- [x] Check whether upcoming features can plug in cleanly: removed-app recovery, duplicate detection, icon management, agent repair prompt, Git repo import, and smart registration.
- [x] Classify findings into must-fix-before-Phase-5, should-fix-soon, and acceptable-for-now.
- [x] Phase 4A: Extract app-library helpers/service from `src/main/index.ts` without changing behavior.
- [x] Move path containment, manifest path normalization, hidden manifest matching, active-status checks, scanned-app merging, scan-result application, app removal, and restore behavior behind the app-library boundary.
- [x] Keep Electron bootstrap, tray/window setup, dialogs, browser/folder shell integration, and IPC wiring in `src/main/index.ts`.
- [x] Phase 4B: Document the deferred `AppLauncherService` boundary for command trust, start/stop/restart orchestration, health checks, and browser-open decisions.
- [x] Phase 4C: Defer renderer component splitting until Phase 5 UI work touches those areas.
- [x] Re-run typecheck and build after architecture changes.
- [x] Run a short manual smoke test after architecture changes.

## Phase 5: Next Implementation Round

- [x] Implement improved removed-app recovery UX.
- [x] Add safer command warning copy for commands from manifest files.
- [x] Improve manual registration duplicate detection for apps with the same project path or manifest path.
- [x] Improve app icon management: choose icon, clear icon, and document `.localapp/icon.png` in the UI.
- [x] Add a lightweight copyable "send this to your agent" repair prompt from startup failures.
- [x] Add dark mode after the current light UI is stable.
- [x] Fix dark-mode background rendering artifacts.
- [x] Hide the native Electron menu bar.

## Phase 6: Agent Registration and LocalApp Convention

Goal: make AppShelf's registration story clear, agent-friendly, and not tied to one specific agent runtime.

- [x] Review and tighten `docs/AGENT_REGISTER_LOCALAPP.md` based on real local project registration feedback.
- [x] Define `.localapp.json` v0 required fields, optional fields, path rules, and examples in a concise reference section.
- [x] Clarify AppShelf's recommended icon convention: `.localapp/icon.png`, generated PNG preferred, SVG fallback allowed.
- [x] Decide to keep `localapp-register` as a repo-local skill draft for now instead of installing it into the user's Codex skills directory.
- [x] Draft repo-local `docs/skills/localapp-register/SKILL.md` from `docs/AGENT_REGISTER_LOCALAPP.md` without making Codex the only supported agent.
- [x] Keep the repo-local skill draft aligned with the agent-agnostic registration guide.
- [x] Add helper launcher policy for simple static apps that need a small `.localapp/` startup adapter.
- [x] Add a lightweight "copy registration prompt for agent" entry point in AppShelf if it improves the manual registration flow.
- [x] Validate the guide with at least one real local project registration workflow.

## Phase 6.5: Import UX Polish

Goal: make the first-time "add a real localhost project" flow obvious from the main Add app entry, while keeping scan-folder management available in Settings.

- [x] Redesign Add app as the primary import entry instead of only a manual registration form.
- [x] Let users choose a project folder directly from the Add app dialog.
- [x] After choosing a folder, check whether the selected folder contains a `.localapp.json`.
- [x] If the selected folder has a valid manifest, preview the discovered app and let the user add it to AppShelf.
- [x] If the selected folder has no manifest, offer clear next actions: manual registration, copy Agent registration prompt, or add the folder as a scan folder.
- [x] If the selected folder contains multiple child manifests, show a compact discovery list before adding.
- [x] Detect duplicate and previously removed apps in the import flow and reuse the existing duplicate/restore behavior.
- [x] Keep Settings focused on long-term scan folder management, not as the only first-time import path.
- [x] Re-run typecheck/build for the updated Add app flow.
- [x] Manually verify the updated Add app flow.

## Phase 6.6: Positioning Polish

Goal: broaden AppShelf's product language from only "web apps" to localhost projects without changing the AppShelf name or `.localapp.json` convention.

- [x] Review project UI, README, spec, agent guide, manifest reference, and product docs for overly narrow webapp wording.
- [x] Keep the product name as AppShelf.
- [x] Keep `.localapp.json` as the manifest filename.
- [x] Update the in-app subtitle to `Localhost Project Library`.
- [x] Update documentation to describe AppShelf as a launcher/library for localhost projects such as web apps, personal sites, blogs, docs, dashboards, games, and tools.
- [x] Keep environment installation out of scope for now; rely on logs, copyable errors, and repair prompts.
- [x] Re-run typecheck/build after positioning copy changes.

## Phase 7: Library Sorting and Custom Order

Goal: let users organize the AppShelf library like a shelf while preserving predictable non-manual sort modes.

- [x] Add a persistent sort mode setting: added order, name A-Z, and name Z-A.
- [x] Remove the first-pass custom drag ordering because the card interaction did not meet the product quality bar.
- [x] Ensure search filters the current sorted list without changing saved order.
- [x] Add a compact sorting control in the toolbar.
- [x] Re-run typecheck/build for card/list sorting behavior.
- [x] Manually verify card/list sorting behavior.

## Phase 7.5: Stability Pass

Goal: stabilize the current AppShelf feature set before starting Git repo import or other larger feature work.

- [x] Review current README, SPEC, TASKS, and agent registration docs for consistency with implemented behavior.
- [x] Review registry compatibility paths, including legacy `webAppStarter` registry migration and removed `custom` sort mode normalization.
- [x] Review main-process boundaries after recent import/sorting changes for obvious shallow-module or ownership drift.
- [x] Review renderer UI for recent polish regressions: Add app import flow, sort dropdown, card/list layout, dark mode, and settings modal.
- [x] Run typecheck/build.
- [x] Decide whether any small fixes are needed before Phase 8.
- [x] Manually smoke test the stable baseline.

## Phase 8: Public Repo Readiness and First Windows Build Review

Goal: prepare AppShelf for a future public repository and decide whether to create a first Windows build before publishing.

- [x] Review committed files for private projects, local paths, old product names, stale screenshots, credentials, and personal data.
- [x] Keep `examples/hello-localapp` as a deliberate sample project and document it clearly.
- [x] Review project structure and public docs for a credible first public repository.
- [ ] Decide whether the repository should be public before or after a first Windows package is available.
- [ ] If packaging is approved, choose a lightweight Windows packaging path.
- [ ] If packaging is approved, produce and test one unsigned local Windows build.
- [ ] Update README with the chosen public release status: source-only, preview build, or release artifact.

## Later / Deferred

- [ ] Consider smart registration from a project folder: infer candidate commands, run a test launch, and write `.localapp.json` only after user confirmation.
- [ ] Revisit custom drag sorting only with a polished tile-style drag interaction, likely using a mature DnD library.
- [ ] Git repo import: paste a repository URL, clone into a chosen folder, then register through the normal AppShelf import flow without automatically trusting or running commands.
- [ ] Re-evaluate packaging after Phase 8 public-readiness cleanup.
- [ ] Unregistered project detection.
- [ ] Git status.
- [ ] App screenshots.
- [ ] Workspaces and batch launch.
- [ ] AI repair handoff beyond copyable prompts.
- [ ] Docker Compose.
- [ ] macOS and Linux support.
- [ ] `localapp` CLI.
