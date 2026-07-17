import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { MAX_CAPTURE_CHARS, runKeyShotSerialized, spawnWithTimeout } from "../src/runner.js";

// The runner spawns the configured headless exe with `node <script> ...`. We point the
// "exe" at the current Node process and pass our fake script as the first license arg,
// so the fake runs in place of keyshot_headless.exe without needing a platform-specific
// wrapper executable.
const mjsPath = fileURLToPath(new URL("./fixtures/fake-keyshot.mjs", import.meta.url));

let tmpRoot: string;

function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    projectRoot: tmpRoot,
    keyshotHeadlessExe: process.execPath,
    keyshotOutputDir: join(tmpRoot, "outputs"),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [mjsPath],
    keyshotTimeoutMs: 30000,
    tmpDir: join(tmpRoot, "work", "tmp"),
    bridgeScriptPath: mjsPath,
    materialPresetsPath: join(tmpRoot, "presets", "materials.json"),
    cameraPresetsPath: join(tmpRoot, "presets", "cameras.json"),
    ...overrides,
  };
}

describe("runner", () => {
  beforeAll(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "keyshot-runner-"));
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns the parsed result on the happy path", async () => {
    const result = await runKeyShotSerialized(makeConfig(), { operation: "status" });
    expect(result.ok).toBe(true);
    expect((result.data as { operation?: string }).operation).toBe("status");
  });

  it("removes the temporary args/result files after a run", async () => {
    const tmpDir = join(tmpRoot, "work", "tmp");
    await runKeyShotSerialized(makeConfig({ tmpDir }), { operation: "status" });
    const leftovers = readdirSync(tmpDir).filter(
      (f) => f.endsWith(".args.json") || f.endsWith(".result.json"),
    );
    expect(leftovers).toEqual([]);
  });

  it("reports a local failure when the headless exe is missing", async () => {
    const result = await runKeyShotSerialized(makeConfig({ keyshotHeadlessExe: join(tmpRoot, "nope.exe") }), {
      operation: "status",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("allows a bare executable name to be resolved from PATH", async () => {
    const previousPath = process.env.PATH;
    process.env.PATH = `${dirname(process.execPath)}${process.platform === "win32" ? ";" : ":"}${previousPath ?? ""}`;
    try {
      const result = await runKeyShotSerialized(
        makeConfig({ keyshotHeadlessExe: basename(process.execPath) }),
        { operation: "status" },
      );
      expect(result.ok).toBe(true);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("reports a clear failure when a PATH command cannot be started", async () => {
    const result = await runKeyShotSerialized(
      makeConfig({ keyshotHeadlessExe: "definitely-not-a-keyshot-command-042" }),
      { operation: "status" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Could not start KeyShot headless");
  });

  it("serializes concurrent KeyShot requests", async () => {
    const start = Date.now();
    const [first, second] = await Promise.all([
      runKeyShotSerialized(makeConfig(), { operation: "status", delayMs: 120 }),
      runKeyShotSerialized(makeConfig(), { operation: "status", delayMs: 120 }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(Date.now() - start).toBeGreaterThanOrEqual(220);
  });

  it("times out a long-running process", async () => {
    const result = await spawnWithTimeout(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], 50);
    expect(result.timedOut).toBe(true);
  });

  it("bounds captured stdout and stderr", async () => {
    const result = await spawnWithTimeout(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(100000));process.stderr.write('y'.repeat(100000))"],
      30000,
    );
    expect(result.stdout.length).toBe(MAX_CAPTURE_CHARS);
    expect(result.stderr.length).toBe(MAX_CAPTURE_CHARS);
  });
});
