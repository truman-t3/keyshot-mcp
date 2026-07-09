import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { localFailure } from "./result.js";
import type { KeyShotRequest, KeyShotResult } from "./types.js";

let queue: Promise<unknown> = Promise.resolve();

export function runKeyShotSerialized(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  const run = queue.then(() => runKeyShot(config, request));
  queue = run.catch(() => undefined);
  return run;
}

async function runKeyShot(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  const exeExists = await exists(config.keyshotHeadlessExe);
  if (!exeExists) {
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

  const id = `${Date.now()}-${randomUUID()}`;
  const argsPath = path.join(config.tmpDir, `${id}.args.json`);
  const resultPath = path.join(config.tmpDir, `${id}.result.json`);
  const payload = {
    ...request,
    defaults: {
      outputDir: config.keyshotOutputDir,
    },
  };

  await fs.writeFile(argsPath, JSON.stringify(payload, null, 2), "utf8");

  const args = [
    ...config.keyshotLicenseArgs,
    "-progress",
    ...(request.scenePath ? [request.scenePath] : []),
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

function spawnWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 2500).unref();
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      stderr += errorMessage(error);
    });
    child.on("close", (exitCode) => {
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
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
