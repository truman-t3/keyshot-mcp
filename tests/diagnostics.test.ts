import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { resolveExecutable, runKeyShotDiagnostics } from "../src/diagnostics.js";
import type { KeyShotResult } from "../src/types.js";

let root: string;

function config(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    projectRoot: root,
    keyshotHeadlessExe: process.execPath,
    keyshotOutputDir: path.join(root, "outputs"),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 600_000,
    tmpDir: path.join(root, "tmp"),
    bridgeScriptPath: path.join(root, "bridge.py"),
    materialPresetsPath: path.join(root, "materials.json"),
    cameraPresetsPath: path.join(root, "cameras.json"),
    ...overrides,
  };
}

const success: KeyShotResult = {
  ok: true,
  data: { version: "14.1", isHeadless: true, availableFunctions: [] },
  outputFiles: [],
  warnings: [],
  keyshotStdoutTail: "",
  error: null,
};

describe("KeyShot diagnostics", () => {
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "keyshot-diagnostics-"));
    writeFileSync(path.join(root, "bridge.py"), "# bridge");
    writeFileSync(path.join(root, "materials.json"), "{}");
    writeFileSync(path.join(root, "cameras.json"), "{}");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("returns a ready result with configuration and checks", async () => {
    const result = await runKeyShotDiagnostics(config(), async () => success);
    const data = result.data as {
      ready: boolean;
      serverVersion: string;
      checks: unknown[];
      config: { outputDir: string };
      availableFunctions?: unknown;
      availableFunctionCount: number;
      capabilities: { render: boolean };
    };
    expect(result.ok).toBe(true);
    expect(data.ready).toBe(true);
    expect(data.serverVersion).toBe("0.9.0");
    expect(data.checks).toHaveLength(6);
    expect(data.config.outputDir).toContain("outputs");
    expect(data.availableFunctions).toBeUndefined();
    expect(data.availableFunctionCount).toBe(0);
    expect(data.capabilities.render).toBe(false);
  });

  it("preserves local checks and suggestions when startup fails", async () => {
    const failed = { ...success, ok: false, error: "License activation failed", errorCode: "LICENSE_UNAVAILABLE", suggestions: ["Activate KeyShot."] };
    const result = await runKeyShotDiagnostics(config(), async () => failed);
    const data = result.data as { ready: boolean; checks: Array<{ id: string; ok: boolean }> };
    expect(result.ok).toBe(false);
    expect(data.ready).toBe(false);
    expect(data.checks.find((check) => check.id === "output-directory")?.ok).toBe(true);
    expect(result.suggestions).toContain("Activate KeyShot.");
  });

  it("treats malformed optional presets as warnings, not startup blockers", async () => {
    const malformed = path.join(root, "bad-camera-presets.json");
    writeFileSync(malformed, "{bad");
    const result = await runKeyShotDiagnostics(config({ cameraPresetsPath: malformed }), async () => success);
    const data = result.data as { ready: boolean; checks: Array<{ id: string; ok: boolean; severity: string }> };
    expect(result.ok).toBe(true);
    expect(data.ready).toBe(true);
    expect(data.checks.find((check) => check.id === "camera-presets")).toMatchObject({ ok: false, severity: "warning" });
  });

  it("does not launch KeyShot when the executable is missing", async () => {
    const runner = vi.fn(async () => success);
    const result = await runKeyShotDiagnostics(config({ keyshotHeadlessExe: path.join(root, "missing.exe") }), runner);
    expect(result.ok).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });

  it("reports an unwritable output path", async () => {
    const outputFile = path.join(root, "not-a-directory");
    writeFileSync(outputFile, "file");
    const result = await runKeyShotDiagnostics(config({ keyshotOutputDir: outputFile }), async () => success);
    const data = result.data as { checks: Array<{ id: string; ok: boolean }> };
    expect(result.ok).toBe(false);
    expect(data.checks.find((check) => check.id === "output-directory")?.ok).toBe(false);
  });

  it("resolves a bare executable from PATH", async () => {
    const resolved = await resolveExecutable(path.basename(process.execPath));
    expect(resolved).not.toBeNull();
  });
});
