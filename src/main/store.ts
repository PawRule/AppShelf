import { app } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { UserRegistry, UserSettings } from "../shared/types";

const defaultSettings: UserSettings = {
  language: "zh",
  theme: "light",
  viewMode: "cards",
  autoOpenBrowser: true,
  closeBehavior: "ask",
  scanFolders: []
};

export function getRegistryPath(): string {
  return join(app.getPath("userData"), "registry.json");
}

function getLegacyRegistryPath(): string {
  return join(app.getPath("appData"), "webAppStarter", "registry.json");
}

export function createDefaultRegistry(): UserRegistry {
  return {
    version: 0,
    settings: defaultSettings,
    apps: [],
    hiddenManifestPaths: [],
    lastScan: undefined
  };
}

export function loadRegistry(): UserRegistry {
  const registryPath = getRegistryPath();

  if (!existsSync(registryPath)) {
    const legacyRegistryPath = getLegacyRegistryPath();
    if (existsSync(legacyRegistryPath)) {
      mkdirSync(dirname(registryPath), { recursive: true });
      copyFileSync(legacyRegistryPath, registryPath);
    } else {
      return createDefaultRegistry();
    }
  }

  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as UserRegistry;
    return {
      version: 0,
      settings: { ...defaultSettings, ...parsed.settings },
      apps: Array.isArray(parsed.apps) ? parsed.apps : [],
      hiddenManifestPaths: Array.isArray(parsed.hiddenManifestPaths) ? parsed.hiddenManifestPaths : [],
      lastScan: parsed.lastScan
    };
  } catch {
    return createDefaultRegistry();
  }
}

export function saveRegistry(registry: UserRegistry): void {
  const registryPath = getRegistryPath();
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf8");
}
