import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import type { AppRecord, AppStatus, LogEntry } from "../shared/types";
import { summarizeLogs } from "./utils";

type ManagedProcess = {
  child: ChildProcessWithoutNullStreams;
  recentLogs: string[];
};

type StatusDetails = {
  errorSummary?: string;
  processId?: number;
  externalProcessIds?: number[];
};

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();

  constructor(
    private readonly onLog: (entry: LogEntry) => void,
    private readonly onStatus: (appId: string, status: AppStatus, details?: StatusDetails) => void
  ) {}

  isRunning(appId: string): boolean {
    return this.processes.has(appId);
  }

  async isPortAvailable(port?: number): Promise<boolean> {
    if (!port) return true;

    return new Promise((resolve) => {
      const server = createServer();

      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });

      server.listen(port, "127.0.0.1");
    });
  }

  async start(app: AppRecord): Promise<boolean> {
    if (this.processes.has(app.id)) {
      return true;
    }

    const portAvailable = await this.isPortAvailable(app.port);
    if (!portAvailable) {
      const pids = app.port ? await this.findListeningPids(app.port) : [];
      const error =
        pids.length > 0
          ? `Port ${app.port} is already in use by PID ${pids.join(", ")}. Stop that process or choose another app before starting this one.`
          : `Port ${app.port} is already in use. Stop the process using that port or choose another app before starting this one.`;
      this.emitSystem(app.id, error);
      this.onStatus(app.id, "failed", { errorSummary: error, externalProcessIds: pids, processId: undefined });
      return false;
    }

    this.emitSystem(app.id, `Starting: ${app.command}`);

    const child = spawn("cmd.exe", ["/d", "/s", "/c", app.command], {
      cwd: app.workingDirectory,
      windowsHide: true,
      env: process.env
    });

    const managed: ManagedProcess = { child, recentLogs: [] };
    this.processes.set(app.id, managed);
    this.onStatus(app.id, "starting", { processId: child.pid, externalProcessIds: undefined, errorSummary: undefined });

    child.stdout.on("data", (chunk: Buffer) => this.emitChunk(app.id, "stdout", chunk, managed));
    child.stderr.on("data", (chunk: Buffer) => this.emitChunk(app.id, "stderr", chunk, managed));

    child.once("error", (error) => {
      managed.recentLogs.push(error.message);
      const summary = summarizeLogs(managed.recentLogs);
      this.processes.delete(app.id);
      this.onStatus(app.id, "failed", { errorSummary: summary, processId: undefined });
    });

    child.once("exit", (code) => {
      const wasStarting = this.processes.has(app.id);
      this.processes.delete(app.id);
      const message = `Process exited with code ${code ?? "unknown"}.`;
      managed.recentLogs.push(message);
      this.emitSystem(app.id, message);

      if (wasStarting) {
        this.onStatus(app.id, code === 0 ? "stopped" : "failed", {
          errorSummary: summarizeLogs(managed.recentLogs),
          processId: undefined,
          externalProcessIds: undefined
        });
      }
    });

    return true;
  }

  async stop(appId: string): Promise<void> {
    const managed = this.processes.get(appId);
    if (!managed) {
      this.onStatus(appId, "stopped", { processId: undefined, externalProcessIds: undefined, errorSummary: undefined });
      return;
    }

    const pid = managed.child.pid;
    if (!pid) {
      managed.child.kill();
      this.processes.delete(appId);
      this.onStatus(appId, "stopped", { processId: undefined, externalProcessIds: undefined, errorSummary: undefined });
      return;
    }

    this.emitSystem(appId, `Stopping process tree: ${pid}`);

    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });

    this.processes.delete(appId);
    this.onStatus(appId, "stopped", { processId: undefined, externalProcessIds: undefined, errorSummary: undefined });
  }

  async stopExternalByPort(appId: string, port?: number): Promise<boolean> {
    if (!port) {
      const error = "Cannot stop external app because no port is configured.";
      this.emitSystem(appId, error);
      this.onStatus(appId, "external", { errorSummary: error });
      return false;
    }

    const pids = await this.findListeningPids(port);
    if (pids.length === 0) {
      const message = `No listening process was found on port ${port}.`;
      this.emitSystem(appId, message);
      this.onStatus(appId, "stopped", { processId: undefined, externalProcessIds: undefined, errorSummary: undefined });
      return true;
    }

    this.emitSystem(appId, `Stopping external process on port ${port}: ${pids.join(", ")}`);

    for (const pid of pids) {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
        killer.once("exit", () => resolve());
        killer.once("error", () => resolve());
      });
    }

    this.onStatus(appId, "stopped", { processId: undefined, externalProcessIds: undefined, errorSummary: undefined });
    return true;
  }

  async findListeningPids(port: number): Promise<number[]> {
    return new Promise((resolve) => {
      const netstat = spawn("netstat", ["-ano", "-p", "tcp"], { windowsHide: true });
      let output = "";

      netstat.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });

      netstat.once("error", () => resolve([]));
      netstat.once("exit", () => {
        const pids = new Set<number>();
        const portPattern = new RegExp(`:${port}$`);

        for (const line of output.split(/\r?\n/)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 5 || parts[0] !== "TCP") continue;

          const localAddress = parts[1];
          const state = parts[3];
          const pid = Number(parts[4]);

          if (state === "LISTENING" && portPattern.test(localAddress) && Number.isInteger(pid)) {
            pids.add(pid);
          }
        }

        resolve([...pids]);
      });
    });
  }

  private emitChunk(
    appId: string,
    stream: "stdout" | "stderr",
    chunk: Buffer,
    managed: ManagedProcess
  ): void {
    const lines = chunk.toString("utf8").split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      managed.recentLogs.push(line);
      if (managed.recentLogs.length > 200) {
        managed.recentLogs.shift();
      }

      this.onLog({ appId, stream, line, timestamp: Date.now() });
    }
  }

  private emitSystem(appId: string, line: string): void {
    this.onLog({ appId, stream: "system", line, timestamp: Date.now() });
  }
}
