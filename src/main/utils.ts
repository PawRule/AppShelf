import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function stableId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

export function commandHash(command: string): string {
  return createHash("sha256").update(command).digest("hex");
}

export function resolveMaybeRelative(basePath: string, target?: string): string | undefined {
  if (!target) return undefined;
  return resolve(basePath, target);
}

export function existingPath(paths: Array<string | undefined>): string | undefined {
  return paths.find((candidate) => candidate && existsSync(candidate));
}

export function summarizeLogs(lines: string[], maxLines = 30): string {
  const relevant = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-maxLines);

  if (relevant.length === 0) {
    return "No error output was captured.";
  }

  return relevant.join("\n");
}
