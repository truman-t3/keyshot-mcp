import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadCameraPresets } from "./camera-presets.js";
import type { ServerConfig } from "./config.js";
import { loadMaterialPresets } from "./presets.js";
import { runKeyShotSerialized } from "./runner.js";
import type { KeyShotResult } from "./types.js";
import { VERSION } from "./version.js";

export type DiagnosticCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
};

type StatusRunner = (config: ServerConfig, request: { operation: "status" }) => Promise<KeyShotResult>;

export async function runKeyShotDiagnostics(
  config: ServerConfig,
  runStatus: StatusRunner = runKeyShotSerialized,
): Promise<KeyShotResult> {
  const checks: DiagnosticCheck[] = [];
  const resolvedExecutable = await resolveExecutable(config.keyshotHeadlessExe);
  checks.push({
    id: "keyshot-executable",
    label: "KeyShot headless executable",
    ok: resolvedExecutable !== null,
    severity: "error",
    message: resolvedExecutable
      ? `Resolved KeyShot headless executable: ${resolvedExecutable}`
      : `KeyShot headless executable was not found: ${config.keyshotHeadlessExe}`,
    suggestion: resolvedExecutable
      ? undefined
      : "Set KEYSHOT_HEADLESS_EXE to the full path of keyshot_headless.exe and restart the MCP client.",
  });

  checks.push(await fileCheck(
    "bridge-script",
    "KeyShot bridge script",
    config.bridgeScriptPath,
    "Reinstall keyshot-mcp so scripts/keyshot_bridge.py is included.",
  ));
  checks.push(await outputWriteCheck(config.keyshotOutputDir));
  checks.push(await presetCheck(
    "camera-presets",
    "Camera presets",
    () => loadCameraPresets(config),
    config.cameraPresetsPath,
  ));
  checks.push(await presetCheck(
    "material-presets",
    "Material presets",
    () => loadMaterialPresets(config),
    config.materialPresetsPath,
  ));

  let keyshotResult: KeyShotResult;
  if (resolvedExecutable && checks.find((check) => check.id === "bridge-script")?.ok) {
    keyshotResult = await runStatus(config, { operation: "status" });
  } else {
    keyshotResult = {
      ok: false,
      data: null,
      outputFiles: [],
      warnings: [],
      keyshotStdoutTail: "",
      error: "KeyShot startup was skipped because a required local file was not available.",
      errorCode: "DIAGNOSTIC_PREREQUISITE_FAILED",
      suggestions: [],
    };
  }

  checks.push({
    id: "keyshot-startup",
    label: "KeyShot headless startup",
    ok: keyshotResult.ok,
    severity: "error",
    message: keyshotResult.ok
      ? "KeyShot headless scripting started successfully."
      : keyshotResult.error ?? "KeyShot headless scripting did not start.",
    suggestion: keyshotResult.ok
      ? undefined
      : keyshotResult.suggestions?.[0] ?? "Open KeyShot normally, confirm the license is active, and retry.",
  });

  const ready = checks.every((check) => check.severity !== "error" || check.ok);
  const suggestions = unique([
    ...checks.flatMap((check) => !check.ok && check.suggestion ? [check.suggestion] : []),
    ...(keyshotResult.suggestions ?? []),
  ]);
  const bridgeData = keyshotResult.data && typeof keyshotResult.data === "object"
    ? keyshotResult.data as Record<string, unknown>
    : {};
  const availableFunctions = Array.isArray(bridgeData.availableFunctions)
    ? bridgeData.availableFunctions.filter((name): name is string => typeof name === "string")
    : [];
  const { availableFunctions: _omittedFunctions, ...bridgeSummary } = bridgeData;

  return {
    ...keyshotResult,
    ok: ready,
    data: {
      ...bridgeSummary,
      availableFunctionCount: availableFunctions.length,
      capabilities: capabilitySummary(availableFunctions),
      serverVersion: VERSION,
      ready,
      config: {
        keyshotHeadlessExe: config.keyshotHeadlessExe,
        resolvedExecutable,
        outputDir: config.keyshotOutputDir,
        allowExternalOutputs: config.keyshotAllowExternalOutputs,
        timeoutMs: config.keyshotTimeoutMs,
        licenseArgsConfigured: config.keyshotLicenseArgs.length > 0,
        bridgeScriptPath: config.bridgeScriptPath,
        cameraPresetsPath: config.cameraPresetsPath,
        materialPresetsPath: config.materialPresetsPath,
      },
      checks,
      suggestions,
    },
    error: ready ? null : keyshotResult.error ?? "KeyShot MCP is not ready. Review the failed diagnostic checks.",
    errorCode: ready ? null : keyshotResult.errorCode ?? "DIAGNOSTIC_FAILED",
    suggestions,
  };
}

function capabilitySummary(availableFunctions: string[]): Record<string, boolean> {
  const available = new Set(availableFunctions);
  return {
    render: available.has("renderImage"),
    inspectObjects: available.has("getObjects"),
    cameras: available.has("getCameras") && available.has("newCamera"),
    standardViews: available.has("setStandardView"),
    importModel: available.has("importFile"),
    materials: available.has("setObjectMaterial"),
    renderOptions: available.has("getRenderOptions"),
    environments: available.has("getActiveEnvironment"),
  };
}

export async function resolveExecutable(command: string): Promise<string | null> {
  if (path.isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    const candidate = path.resolve(command);
    return await isFile(candidate) ? candidate : null;
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32" && path.extname(command) === ""
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry.replace(/^"|"$/g, ""), `${command}${extension}`);
      if (await isFile(candidate)) return path.resolve(candidate);
    }
  }
  return null;
}

async function fileCheck(
  id: string,
  label: string,
  filePath: string,
  suggestion: string,
): Promise<DiagnosticCheck> {
  const ok = await isFile(filePath);
  return { id, label, ok, severity: "error", message: ok ? `Found: ${filePath}` : `Missing: ${filePath}`, suggestion: ok ? undefined : suggestion };
}

async function outputWriteCheck(outputDir: string): Promise<DiagnosticCheck> {
  const probe = path.join(outputDir, `.keyshot-mcp-write-test-${randomUUID()}`);
  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(probe, "ok", "utf8");
    await fs.rm(probe, { force: true });
    return {
      id: "output-directory",
      label: "Output directory",
      ok: true,
      severity: "error",
      message: `Output directory is writable: ${outputDir}`,
    };
  } catch (error) {
    await fs.rm(probe, { force: true }).catch(() => undefined);
    return {
      id: "output-directory",
      label: "Output directory",
      ok: false,
      severity: "error",
      message: `Output directory is not writable: ${outputDir} (${errorMessage(error)})`,
      suggestion: "Set KEYSHOT_OUTPUT_DIR to a local folder where the current user can create files.",
    };
  }
}

async function presetCheck(
  id: string,
  label: string,
  loader: () => Promise<unknown[]>,
  source: string,
): Promise<DiagnosticCheck> {
  try {
    const presets = await loader();
    return {
      id,
      label,
      ok: true,
      severity: "warning",
      message: `${label} loaded successfully (${presets.length}) from ${source}`,
    };
  } catch (error) {
    return {
      id,
      label,
      ok: false,
      severity: "warning",
      message: errorMessage(error),
      suggestion: `Fix the JSON syntax in ${source}, or remove the custom environment variable to use built-in presets.`,
    };
  }
}

async function isFile(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isFile();
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
