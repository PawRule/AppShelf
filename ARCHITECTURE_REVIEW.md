# AppShelf Architecture Review

Status: Phase 4 review draft
Date: 2026-06-18

## Scope

This review checks whether the current AppShelf codebase has stable enough module boundaries for Phase 5 work:

- removed-app recovery UX
- command warning copy
- duplicate detection
- icon management
- lightweight agent repair prompt
- dark mode

The review focuses on deep modules: simple public interfaces that hide meaningful internal complexity.

## Executive Summary

AppShelf is in good shape for an MVP. The strongest modules are `ProcessManager`, `manifest.ts`, `store.ts`, and `preload/index.ts`; they have clear responsibilities and small interfaces.

The main architecture risk is concentration of product workflow in two large files:

- `src/main/index.ts` owns window/tray creation, IPC registration, registry mutation, scan merging, command trust flow, start/health orchestration, external process handling, app removal, and restore behavior.
- `src/renderer/src/main.tsx` owns global UI state, all view components, settings, forms, logs, and most user interaction flows.

This is acceptable for the MVP, but Phase 5 should not continue adding behavior into these two files without extracting deeper modules. The first hardening pass should be small and behavior-preserving.

## Current Architecture

```text
src/shared/types.ts
  Shared manifest, registry, process, scan, and IPC-adjacent data types.

src/main/index.ts
  Electron app bootstrap, window/tray, IPC handlers, app library mutation,
  scanning coordination, process start/stop orchestration, command trust,
  external-running behavior, browser/folder integration.

src/main/manifest.ts
  .localapp.json parsing/writing, scan traversal, icon discovery, manifest diagnostics.

src/main/processManager.ts
  Windows command execution, stdout/stderr log streaming, port checks,
  PID lookup, process tree stop, external process stop by port.

src/main/store.ts
  Registry defaulting, legacy migration, load/save to userData registry.json.

src/main/health.ts
  URL readiness polling.

src/preload/index.ts
  Typed renderer-facing bridge over IPC.

src/renderer/src/main.tsx
  React app state, views, dialogs, settings, forms, and user interaction flows.

src/renderer/src/i18n.ts
  Chinese and English UI strings.

src/renderer/src/styles.css
  Global renderer styling.
```

## Deep Module Assessment

### `ProcessManager`

Verdict: reasonably deep.

The public interface is compact: start, stop, external stop, port PID lookup, running check. It hides Windows command execution, log chunking, netstat parsing, and taskkill behavior.

Risks:

- It emits status changes through callbacks, while registry persistence lives elsewhere. This is acceptable but makes lifecycle reasoning split between `ProcessManager` and `src/main/index.ts`.
- It only knows process-owned state, not app-library state. That is a good boundary.

Recommendation:

- Keep this module focused. Do not add UI trust, registry mutation, or browser behavior here.
- Future Windows Job Objects work should remain behind this module.

### `manifest.ts`

Verdict: moderately deep, but it mixes manifest concerns and scanning concerns.

It currently owns:

- manifest validation
- manifest-to-app-record conversion
- icon discovery
- manual registration manifest writing
- config update manifest writing
- recursive folder scanning
- scan diagnostics

This is still manageable, but Phase 5 duplicate detection and icon management may stress it.

Recommendation:

- Accept for now.
- If scanning grows, split later into `manifest.ts` and `scanner.ts`.
- Keep smart registration out of this module until Phase 6; candidate inference is a separate responsibility.

### `store.ts`

Verdict: deep and simple.

The interface is small and hides registry path, legacy migration, defaults, parse fallback, and persistence.

Risks:

- It currently has no schema migration layer beyond default merging. Fine for v0, but registry shape is growing.

Recommendation:

- Keep as-is for Phase 5.
- Add explicit migrations only when `version` increases.

### `preload/index.ts`

Verdict: good boundary.

Renderer gets a narrow `window.appShelf` API. It does not access Node directly.

Risk:

- API names mirror implementation-level IPC names. This is acceptable now, but future features should keep the preload API product-oriented.

Recommendation:

- Keep using preload as the only renderer-to-main boundary.

### `src/main/index.ts`

Verdict: shallow and broad.

This file is the main architectural pressure point. It exposes no clean application-service boundary and directly coordinates many responsibilities.

Current responsibilities include:

- Electron bootstrap
- tray/window lifecycle
- IPC handler registration
- registry reads/writes
- scan result application
- hidden manifest filtering
- app removal and restore
- command trust
- start/stop/restart orchestration
- URL health checks
- browser/folder integration

Why this matters:

- Phase 5 removed-app recovery, duplicate detection, command warning copy, icon management, and repair prompts all naturally want to add logic here.
- If added directly, this file becomes the product logic dump.

Recommended extraction before substantial Phase 5 work:

- `AppLibraryService`
  - owns registry mutation and app lookup
  - owns merge scanned apps
  - owns remove/restore hidden manifest behavior
  - owns duplicate detection hooks
- `AppLauncherService`
  - owns command trust, start/stop/restart orchestration, health check, browser-open decision
  - coordinates `ProcessManager` without exposing renderer concerns
- Keep Electron window/tray and IPC binding in `index.ts`.

The extraction can be incremental. Do not create a framework or generic service container.

### `src/renderer/src/main.tsx`

Verdict: shallow and broad.

The renderer is currently a single 1,000+ line file containing:

- top-level app state
- toolbar
- cards
- list
- detail drawer
- settings
- scan feedback
- add/edit dialogs
- form state and save flows
- removal/start/stop/restart flow

This was efficient for MVP speed, but Phase 5 UI additions will make it harder to reason about.

Recommended extraction before or during Phase 5:

- `components/AppCard.tsx`
- `components/AppList.tsx`
- `components/DetailDrawer.tsx`
- `components/SettingsPanel.tsx`
- `components/ManualAppDialog.tsx`
- `components/AppConfigDialog.tsx`
- `components/AppIcon.tsx`
- `hooks/useAppShelfRegistry.ts`

The hook should own registry loading, log subscription, status subscription, and registry updates. Components should receive props and avoid direct IPC calls except through callbacks.

### `styles.css`

Verdict: acceptable for MVP, but not ready for dark mode.

The stylesheet is global and hard-codes colors throughout. Dark mode would be noisy if implemented directly.

Recommendation before dark mode:

- Introduce CSS variables for core colors, borders, surfaces, text, status colors, and shadows.
- Then implement `[data-theme="dark"]` or a root class.

## Data Model Review

### Current Strengths

- `LocalAppManifest` stays small and project-owned.
- `UserRegistry` separates local user state from project manifest.
- `ScanResult` and `ScanDiagnostic` are explicit.
- `StartResult` correctly models trust vs error outcomes.

### Boundary Concern

`AppRecord` currently mixes several categories:

- manifest/project metadata: name, description, command, url, port, projectPath, manifestPath, workingDirectory
- user-local state: trustedCommandHash
- runtime state: status, processId, externalProcessIds, lastErrorSummary
- source identity: source

This is tolerable for v0, but Phase 5 duplicate detection and repair prompt generation will be cleaner if we define helper functions or service methods rather than letting the renderer inspect every field directly.

Recommendation:

- Do not split the type immediately.
- Introduce library-level helper methods first, such as `canRemoveApp`, `isActiveStatus`, `isSameProject`, and `buildRepairPrompt`.
- Revisit type separation only when registry migrations become necessary.

## IPC Boundary Review

Current IPC surface is pragmatic and understandable. The preload API is typed and renderer-friendly.

Issues:

- Some IPC handlers return an unchanged registry on invalid operations, such as trying to remove a running app. The renderer currently pre-checks active status. This is convenient but weakens domain feedback.
- Future duplicate detection should return structured outcomes instead of only `UserRegistry`.

Recommendation:

- For Phase 5, introduce small result types for actions that can fail for user-understandable reasons:
  - remove app
  - create manual app
  - update app
- Keep current registry-returning APIs where failure is unlikely.

## Phase 5 Readiness

### Removed-App Recovery UX

Needs `AppLibraryService` support:

- terminology should become "removed apps" in UI
- remove confirmation should explain restore path
- manual registration should detect hidden manifest path and offer restore

Current code can support this, but direct changes in `index.ts` and `main.tsx` would increase coupling.

### Command Warning Copy

Mostly UI/preload-level copy. Low architectural risk.

Should remain in renderer confirmation flow, but warning text should be generated from a single helper so it is consistent.

### Duplicate Detection

Needs main-process domain logic, not renderer-only checks.

Detection should compare:

- normalized project path
- normalized manifest path
- possibly command + working directory for local-only manual apps

Return a structured result so UI can show "already exists", "restore removed app", or "continue anyway".

### Icon Management

Low to moderate risk.

Current `manifest.ts` already knows how to write `icon`. UI can choose icon. Clearing icon should be supported explicitly. If the target is `.localapp/icon.png` later, copying user-selected files into the project should be a separate explicit action, not hidden behavior.

### Agent Repair Prompt

Should not live in renderer string concatenation.

Recommended location:

- shared or main helper that accepts an `AppRecord`, recent logs, and app version/context
- renderer calls it through local utility or IPC depending on whether logs remain renderer-only

Current logs only live in renderer memory after streaming. For lightweight Phase 5, a renderer utility is acceptable. Future diagnostics zip should move log history into main/registry or a diagnostics service.

### Dark Mode

Requires CSS variable groundwork first.

Do not implement dark mode by duplicating large blocks of CSS.

## Findings

### Must Fix Before Phase 5

1. Create `ARCHITECTURE_REVIEW.md`.
2. Do a small low-risk extraction plan before adding Phase 5 domain behavior:
   - at minimum extract app-library helpers from `src/main/index.ts`
   - at minimum extract renderer components or a registry hook before dark mode/icon UX expands

### Should Fix Soon

1. Extract `AppLibraryService` from `src/main/index.ts`.
2. Extract `AppLauncherService` from `src/main/index.ts`.
3. Split `src/renderer/src/main.tsx` into component modules.
4. Add structured action result types for remove/create/update flows.
5. Add path normalization helpers shared by hidden app restore, duplicate detection, and scan folder removal.
6. Introduce CSS variables before dark mode.

### Acceptable For Now

1. `ProcessManager` callback model.
2. `manifest.ts` owning both manifest parsing and scanning.
3. `AppRecord` mixing metadata, user trust, and runtime fields.
4. `taskkill /T /F` as the Windows MVP process cleanup mechanism.
5. Registry version staying at `0` until a breaking schema migration is needed.

## Phase 4A Implementation Note

`src/main/appLibrary.ts` now owns the first app-library boundary:

- path containment
- manifest path normalization
- hidden manifest matching
- active app checks
- scanned app merging
- scan result application
- app removal
- hidden manifest restore
- scan folder removal effects

`src/main/index.ts` still owns Electron bootstrap, IPC wiring, shell/browser integration, and launcher orchestration. This keeps Phase 4A behavior-preserving while reducing pressure on the Electron entry point.

## Recommended Remaining Phase 4 Implementation Plan

1. Do not extract `AppLauncherService` yet; keep that boundary documented for later.
2. Extract renderer components only if Phase 5 UI work touches those areas; do not refactor the entire renderer for its own sake.
3. Run `npm.cmd run typecheck` and `npm.cmd run build`.
4. Ask for a manual smoke test before starting Phase 5.

## Conclusion

The codebase is ready for Phase 4 hardening. It should not jump directly into Phase 5 feature work without at least a small boundary pass around app-library behavior. The goal is not a large rewrite; it is to stop product rules from accumulating in Electron bootstrap and one large React file.
