import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { getConfig, type ServerConfig } from "../src/config.js";

const PRESERVED = { ...process.env };

function makeFakeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    projectRoot: "C:/fake/project",
    keyshotHeadlessExe: "C:/fake/keyshot_headless.exe",
    keyshotOutputDir: "C:/fake/outputs",
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 30000,
    tmpDir: "C:/fake/work/tmp",
    bridgeScriptPath: "C:/fake/scripts/keyshot_bridge.py",
    materialPresetsPath: "C:/fake/presets/materials.json",
    cameraPresetsPath: "C:/fake/presets/cameras.json",
    ...overrides,
  };
}

describe("getConfig", () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("KEYSHOT_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...PRESERVED };
  });

  it("uses sensible defaults when no env vars are set", () => {
    const config = getConfig();
    expect(config.keyshotHeadlessExe).toBe(
      process.platform === "win32" ? "keyshot_headless.exe" : "keyshot_headless",
    );
    expect(config.keyshotTimeoutMs).toBe(600_000);
    expect(config.keyshotAllowExternalOutputs).toBe(false);
    expect(config.bridgeScriptPath).toBe(path.join(config.projectRoot, "scripts", "keyshot_bridge.py"));
    expect(config.tmpDir).toBe(path.join(config.projectRoot, "work", "tmp"));
    expect(config.cameraPresetsPath).toBe(path.join(config.projectRoot, "presets", "cameras.json"));
  });

  it("enables external outputs only for an explicit true value", () => {
    process.env.KEYSHOT_ALLOW_EXTERNAL_OUTPUTS = "true";
    expect(getConfig().keyshotAllowExternalOutputs).toBe(true);
  });

  it("honors KEYSHOT_OUTPUT_DIR override", () => {
    process.env.KEYSHOT_OUTPUT_DIR = "D:/my-renders";
    expect(getConfig().keyshotOutputDir).toBe(path.resolve("D:/my-renders"));
  });

  it("honors KEYSHOT_HEADLESS_EXE override", () => {
    process.env.KEYSHOT_HEADLESS_EXE = "D:/apps/keyshot_headless.exe";
    expect(getConfig().keyshotHeadlessExe).toBe("D:/apps/keyshot_headless.exe");
  });

  it("honors KEYSHOT_CAMERA_PRESETS override", () => {
    process.env.KEYSHOT_CAMERA_PRESETS = "D:/presets/my-cameras.json";
    expect(getConfig().cameraPresetsPath).toBe(path.resolve("D:/presets/my-cameras.json"));
  });

  it("parses KEYSHOT_TIMEOUT_MS as a positive integer", () => {
    process.env.KEYSHOT_TIMEOUT_MS = "120000";
    expect(getConfig().keyshotTimeoutMs).toBe(120_000);
  });

  it("falls back to default timeout for invalid KEYSHOT_TIMEOUT_MS", () => {
    process.env.KEYSHOT_TIMEOUT_MS = "not-a-number";
    expect(getConfig().keyshotTimeoutMs).toBe(600_000);
  });

  it("splits KEYSHOT_LICENSE_ARGS preserving quotes", () => {
    process.env.KEYSHOT_LICENSE_ARGS = '-user "Jane Doe" -key abc123';
    expect(getConfig().keyshotLicenseArgs).toEqual(["-user", "Jane Doe", "-key", "abc123"]);
  });

  it("keeps the provided fake config shape for tests", () => {
    const config = makeFakeConfig();
    expect(config.keyshotTimeoutMs).toBe(30000);
  });
});
