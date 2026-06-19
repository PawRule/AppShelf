import { dirname, join, relative, resolve } from "node:path";
import type { AppRecord, ScanResult, UserRegistry } from "../shared/types";

type RuntimeState = {
  isProcessRunning: (appId: string) => boolean;
};

export function findApp(registry: UserRegistry, appId: string): AppRecord | undefined {
  return registry.apps.find((record) => record.id === appId);
}

export function updateApp(registry: UserRegistry, appId: string, patch: Partial<AppRecord>): UserRegistry {
  return {
    ...registry,
    apps: registry.apps.map((record) => (record.id === appId ? { ...record, ...patch } : record))
  };
}

export function isActiveApp(app: AppRecord, runtime: RuntimeState): boolean {
  return (
    runtime.isProcessRunning(app.id) ||
    app.status === "running" ||
    app.status === "external" ||
    app.status === "starting" ||
    app.status === "unreachable"
  );
}

export function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  const pathDiff = relative(normalizedParent, normalizedChild);
  return pathDiff === "" || (!pathDiff.startsWith("..") && !pathDiff.includes(":"));
}

export function normalizePath(path: string): string {
  return resolve(path).toLowerCase();
}

export function findRemovedManifestForProject(registry: UserRegistry, projectPath: string): string | undefined {
  const expectedManifestPath = normalizePath(join(resolve(projectPath), ".localapp.json"));
  return registry.hiddenManifestPaths.find((manifestPath) => normalizePath(manifestPath) === expectedManifestPath);
}

export function findDuplicateAppForProject(registry: UserRegistry, projectPath: string): AppRecord | undefined {
  const normalizedProjectPath = normalizePath(projectPath);
  const normalizedManifestPath = normalizePath(join(resolve(projectPath), ".localapp.json"));

  return registry.apps.find((app) => {
    if (normalizePath(app.projectPath) === normalizedProjectPath) return true;
    return Boolean(app.manifestPath && normalizePath(app.manifestPath) === normalizedManifestPath);
  });
}

export function applyScanResult(registry: UserRegistry, scanResult: ScanResult, runtime: RuntimeState): UserRegistry {
  return mergeApps(
    {
      ...registry,
      lastScan: {
        scannedAt: scanResult.scannedAt,
        discoveredCount: scanResult.apps.length,
        diagnostics: scanResult.diagnostics
      }
    },
    scanResult.apps,
    runtime
  );
}

export function mergeApps(registry: UserRegistry, discovered: AppRecord[], runtime: RuntimeState): UserRegistry {
  const existingById = new Map(registry.apps.map((record) => [record.id, record]));
  const existingManual = registry.apps.filter((record) => !record.manifestPath);
  const hiddenManifests = new Set(registry.hiddenManifestPaths.map((manifestPath) => normalizePath(manifestPath)));
  const mergedManifestApps = discovered
    .filter((record) => !record.manifestPath || !hiddenManifests.has(normalizePath(record.manifestPath)))
    .map((record) => {
      const existing = existingById.get(record.id);
      const isRunning = runtime.isProcessRunning(record.id);

      return {
        ...record,
        trustedCommandHash: existing?.trustedCommandHash,
        status: isRunning ? (existing?.status ?? record.status) : "stopped",
        processId: isRunning ? existing?.processId : undefined,
        externalProcessIds: isRunning ? existing?.externalProcessIds : undefined,
        lastErrorSummary: isRunning ? existing?.lastErrorSummary : undefined
      } satisfies AppRecord;
    });

  const seen = new Set(mergedManifestApps.map((record) => record.id));

  return {
    ...registry,
    apps: [...mergedManifestApps, ...existingManual.filter((record) => !seen.has(record.id))]
  };
}

export function removeAppsFromScanFolder(registry: UserRegistry, folder: string): UserRegistry {
  return {
    ...registry,
    settings: {
      ...registry.settings,
      scanFolders: registry.settings.scanFolders.filter((scanFolder) => scanFolder !== folder)
    },
    apps: registry.apps.filter((appRecord) => {
      if (!appRecord.manifestPath) return true;
      return !isPathInside(folder, dirname(appRecord.manifestPath));
    })
  };
}

export function removeAppFromLibrary(
  registry: UserRegistry,
  appId: string,
  runtime: RuntimeState
): { registry: UserRegistry; removed: boolean; reason?: "notFound" | "active" } {
  const appRecord = findApp(registry, appId);
  if (!appRecord) return { registry, removed: false, reason: "notFound" };

  if (isActiveApp(appRecord, runtime)) {
    return { registry, removed: false, reason: "active" };
  }

  let hiddenManifestPaths = registry.hiddenManifestPaths;

  if (appRecord.manifestPath) {
    const normalizedManifestPath = resolve(appRecord.manifestPath);
    if (!hiddenManifestPaths.some((path) => normalizePath(path) === normalizePath(normalizedManifestPath))) {
      hiddenManifestPaths = [...hiddenManifestPaths, normalizedManifestPath];
    }
  }

  return {
    registry: {
      ...registry,
      hiddenManifestPaths,
      apps: registry.apps.filter((record) => record.id !== appId)
    },
    removed: true
  };
}

export function restoreHiddenManifest(registry: UserRegistry, manifestPath: string): UserRegistry {
  const normalizedManifestPath = normalizePath(manifestPath);

  return {
    ...registry,
    hiddenManifestPaths: registry.hiddenManifestPaths.filter((path) => normalizePath(path) !== normalizedManifestPath)
  };
}
