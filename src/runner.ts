import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { localFailure } from "./result.js";
import { normalizeOutputPaths } from "./output-paths.js";
import type { KeyShotRequest, KeyShotResult } from "./types.js";

let queue: Promise<unknown> = Promise.resolve();

export function runKeyShotSerialized(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  const run = queue.then(() => runKeyShot(config, request));
  queue = run.catch(() => undefined);
  return run;
}

async function runKeyShot(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  if (isPathLike(config.keyshotHeadlessExe) && !(await exists(config.keyshotHeadlessExe))) {
    return localFailure(`KeyShot headless executable not found: ${config.keyshotHeadlessExe}`);
  }

  const bridgeExists = await exists(config.bridgeScriptPath);
  if (!bridgeExists) {
    return localFailure(`KeyShot bridge script not found: ${config.bridgeScriptPath}`);
  }

  if (request.scenePath && !(await exists(request.scenePath))) {
    return localFailure(`Scene file not found: ${request.scenePath}`);
  }

  await fs.mkdir(config.tmpDir, { recursive: true });
  await fs.mkdir(config.keyshotOutputDir, { recursive: true });

  let normalizedRequest: KeyShotRequest;
  try {
    normalizedRequest = await normalizeOutputPaths(config, request);
  } catch (error) {
    return localFailure(errorMessage(error));
  }

  const id = `${Date.now()}-${randomUUID()}`;
  const argsPath = path.join(config.tmpDir, `${id}.args.json`);
  const resultPath = path.join(config.tmpDir, `${id}.result.json`);
  const payload = {
    ...normalizedRequest,
    defaults: {
      outputDir: config.keyshotOutputDir,
    },
  };

  await fs.writeFile(argsPath, JSON.stringify(payload, null, 2), "utf8");

  const args = [
    ...config.keyshotLicenseArgs,
    "-progress",
    ...(normalizedRequest.scenePath ? [normalizedRequest.scenePath] : []),
    "-script",
    config.bridgeScriptPath,
    argsPath,
    resultPath,
  ];

  try {
    const processResult = await spawnWithTimeout(config.keyshotHeadlessExe, args, config.keyshotTimeoutMs);
    const stdoutTail = tail(processResult.stdout, 6000);
    const stderrTail = tail(processResult.stderr, 6000);

    let parsed: KeyShotResult | null = null;
    if (await exists(resultPath)) {
      try {
        parsed = JSON.parse(await fs.readFile(resultPath, "utf8")) as KeyShotResult;
      } catch (error) {
        return localFailure(`Could not parse KeyShot result JSON: ${errorMessage(error)}`, {
          keyshotStdoutTail: stdoutTail,
          warnings: stderrTail ? [`stderr: ${stderrTail}`] : [],
        });
      }
    }

    if (processResult.spawnError) {
      return localFailure(`Could not start KeyShot headless: ${processResult.spawnError}`, {
        keyshotStdoutTail: stdoutTail,
        warnings: stderrTail ? [`stderr: ${stderrTail}`] : [],
      });
    }

    if (processResult.timedOut) {
      return localFailure(`KeyShot timed out after ${config.keyshotTimeoutMs}ms`, {
        data: parsed?.data ?? null,
        outputFiles: parsed?.outputFiles ?? [],
        warnings: [...(parsed?.warnings ?? []), ...(stderrTail ? [`stderr: ${stderrTail}`] : [])],
        keyshotStdoutTail: stdoutTail,
      });
    }

    if (!parsed) {
      return localFailure(
        `KeyShot did not produce a result file. Exit code: ${processResult.exitCode ?? "unknown"}`,
        {
          keyshotStdoutTail: stdoutTail,
          warnings: stderrTail ? [`stderr: ${stderrTail}`] : [],
        },
      );
    }

    parsed.keyshotStdoutTail = stdoutTail || parsed.keyshotStdoutTail || "";
    if (stderrTail) parsed.warnings = [...parsed.warnings, `stderr: ${stderrTail}`];

    if (processResult.exitCode !== 0 && parsed.ok) {
      return {
        ...parsed,
        ok: false,
        error: `KeyShot exited with code ${processResult.exitCode}`,
      };
    }

    return parsed;
  } finally {
    // Best-effort cleanup so work/tmp does not accumulate args/result files.
    await cleanupTmp([argsPath, resultPath]).catch(() => undefined);
  }
}

async function cleanupTmp(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (filePath) => {
      if (await exists(filePath)) {
        await fs.rm(filePath, { force: true });
      }
    }),
  );
}

export const MAX_CAPTURE_CHARS = 64 * 1024;

export function spawnWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let spawnError: string | null = null;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child.pid, "SIGTERM");
      setTimeout(() => {
        if (!settled && process.platform !== "win32") terminateProcessTree(child.pid, "SIGKILL");
      }, 2500).unref();
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, String(chunk));
    });
    child.on("error", (error) => {
      spawnError = errorMessage(error);
      stderr = appendBounded(stderr, spawnError);
    });
    child.on("close", (exitCode) => {
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut, spawnError });
    });
  });
}

function terminateProcessTree(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => undefined);
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may already have exited.
    }
  }
}

function appendBounded(current: string, addition: string): string {
  const combined = current + addition;
  return combined.length <= MAX_CAPTURE_CHARS
    ? combined
    : combined.slice(combined.length - MAX_CAPTURE_CHARS);
}

function isPathLike(command: string): boolean {
  return path.isAbsolute(command) || command.includes("/") || command.includes("\\");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function tail(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : value.slice(value.length - maxChars);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
