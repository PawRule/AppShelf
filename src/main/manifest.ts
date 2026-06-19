import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { AppConfigInput, AppRecord, LocalAppManifest, ManualAppInput, ScanDiagnostic, ScanResult } from "../shared/types";
import { existingPath, resolveMaybeRelative, stableId } from "./utils";

const MAX_SCAN_DEPTH = 5;

function isManifest(value: unknown): value is LocalAppManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as LocalAppManifest;
  return typeof manifest.name === "string" && typeof manifest.command === "string";
}

function normalizePort(port: unknown): number | undefined {
  if (typeof port === "number" && Number.isInteger(port) && port > 0) {
    return port;
  }

  if (typeof port === "string" && /^\d+$/.test(port)) {
    return Number(port);
  }

  return undefined;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toManifestPath(projectPath: string, target?: string): string | undefined {
  const value = optionalText(target);
  if (!value) return undefined;
  if (!isAbsolute(value)) return value;

  const relativePath = relative(projectPath, value);
  if (!relativePath.startsWith("..") && !relativePath.includes(":")) {
    return relativePath || ".";
  }

  return value;
}

function workingDirectoryForManifest(projectPath: string, workingDirectory: string): string {
  const relativePath = relative(projectPath, workingDirectory);
  if (!relativePath || relativePath === "") return ".";
  if (!relativePath.startsWith("..") && !relativePath.includes(":")) return relativePath;
  return workingDirectory;
}

async function readManifestWithDiagnostic(
  manifestPath: string
): Promise<{ record?: AppRecord; diagnostic?: ScanDiagnostic }> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isManifest(parsed)) {
      return {
        diagnostic: {
          kind: "invalidManifest",
          path: manifestPath,
          detail: "Missing required string fields: name and command."
        }
      };
    }

    const projectPath = dirname(manifestPath);
    const workingDirectory = resolve(projectPath, parsed.workingDirectory ?? ".");
    const port = normalizePort(parsed.port);
    const url = parsed.url ?? (port ? `http://localhost:${port}` : undefined);
    const iconPath = existingPath([
      resolveMaybeRelative(projectPath, parsed.icon),
      join(projectPath, ".localapp", "icon.png"),
      join(projectPath, "public", "favicon.ico"),
      join(projectPath, "public", "icon.png"),
      join(projectPath, "src", "assets", "logo.png"),
      join(projectPath, "src", "assets", "logo.svg")
    ]);

    return {
      record: {
        id: stableId(manifestPath),
        name: parsed.name,
        description: parsed.description,
        iconPath,
        command: parsed.command,
        url,
        port,
        projectPath,
        manifestPath,
        workingDirectory,
        source: "manifest",
        status: "stopped"
      }
    };
  } catch (error) {
    return {
      diagnostic: {
        kind: "invalidManifest",
        path: manifestPath,
        detail: error instanceof Error ? error.message : "Unable to parse manifest."
      }
    };
  }
}

export async function readManifest(manifestPath: string): Promise<AppRecord | undefined> {
  const result = await readManifestWithDiagnostic(manifestPath);
  return result.record;
}

async function findManifestFiles(root: string, diagnostics: ScanDiagnostic[], depth = 0): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return [];

  if (!existsSync(root)) {
    if (depth === 0) {
      diagnostics.push({
        kind: "folderMissing",
        path: root
      });
    }
    return [];
  }

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    diagnostics.push({
      kind: "folderUnreadable",
      path: root,
      detail: error instanceof Error ? error.message : "Unable to read folder."
    });
    return [];
  }

  const manifests: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }

    const fullPath = join(root, entry.name);

    if (entry.isFile() && entry.name === ".localapp.json") {
      manifests.push(fullPath);
      continue;
    }

    if (entry.isDirectory()) {
      manifests.push(...(await findManifestFiles(fullPath, diagnostics, depth + 1)));
    }
  }

  return manifests;
}

export async function scanFolders(scanFolders: string[]): Promise<ScanResult> {
  const manifestFiles = new Set<string>();
  const diagnostics: ScanDiagnostic[] = [];

  for (const folder of scanFolders) {
    const folderDiagnosticsStart = diagnostics.length;
    const files = await findManifestFiles(folder, diagnostics);
    files.forEach((file) => manifestFiles.add(file));

    if (files.length === 0 && diagnostics.length === folderDiagnosticsStart) {
      diagnostics.push({
        kind: "emptyFolder",
        path: folder
      });
    }
  }

  const results = await Promise.all([...manifestFiles].map((file) => readManifestWithDiagnostic(file)));
  const apps = results.flatMap((result) => (result.record ? [result.record] : []));

  for (const result of results) {
    if (result.diagnostic) {
      diagnostics.push(result.diagnostic);
    }
  }

  return {
    apps,
    diagnostics,
    scannedAt: Date.now()
  };
}

export async function createManualApp(input: ManualAppInput): Promise<AppRecord> {
  const projectPath = resolve(input.projectPath);
  const manifestPath = join(projectPath, ".localapp.json");
  const port = normalizePort(input.port);
  const url = input.url ?? (port ? `http://localhost:${port}` : undefined);

  if (input.writeManifest) {
    const manifest: LocalAppManifest = {
      $schema: "https://localapp.dev/schema/v0.json",
      name: input.name,
      description: input.description,
      icon: input.iconPath,
      command: input.command,
      url,
      port,
      workingDirectory: "."
    };

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }

  return {
    id: stableId(input.writeManifest ? manifestPath : `${projectPath}:${input.command}`),
    name: input.name || basename(projectPath),
    description: input.description,
    iconPath: input.iconPath,
    command: input.command,
    url,
    port,
    projectPath,
    manifestPath: input.writeManifest ? manifestPath : undefined,
    workingDirectory: projectPath,
    source: input.writeManifest ? "manifest" : "manual",
    status: "stopped"
  };
}

export async function updateAppConfig(existing: AppRecord, input: AppConfigInput): Promise<AppRecord> {
  const port = normalizePort(input.port);
  const url = optionalText(input.url) ?? (port ? `http://localhost:${port}` : undefined);
  const description = optionalText(input.description);
  const iconPath = optionalText(input.iconPath);

  if (existing.manifestPath) {
    const manifest: LocalAppManifest = {
      $schema: "https://localapp.dev/schema/v0.json",
      name: input.name,
      description,
      icon: toManifestPath(existing.projectPath, iconPath),
      command: input.command,
      url,
      port,
      workingDirectory: workingDirectoryForManifest(existing.projectPath, existing.workingDirectory)
    };

    await writeFile(existing.manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const reread = await readManifest(existing.manifestPath);
    if (reread) {
      return {
        ...reread,
        trustedCommandHash: existing.command === reread.command ? existing.trustedCommandHash : undefined,
        status: existing.status
      };
    }
  }

  return {
    ...existing,
    name: input.name,
    description,
    iconPath,
    command: input.command,
    url,
    port,
    trustedCommandHash: existing.command === input.command ? existing.trustedCommandHash : undefined
  };
}
