import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import type { KeyShotOperation } from "../src/types.js";
import { runRenderQueue } from "../src/queue.js";
import {
  MAX_CAPTURE_CHARS,
  runKeyShotSerialized,
  spawnWithTimeout,
} from "../src/runner.js";

// The runner spawns the configured headless exe with `node <script> ...`. We point the
// "exe" at the current Node process and pass our fake script as the first license arg,
// so the fake runs in place of keyshot_headless.exe without needing a platform-specific
// wrapper executable.
const mjsPath = fileURLToPath(
  new URL("./fixtures/fake-keyshot.mjs", import.meta.url),
);

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
    const result = await runKeyShotSerialized(makeConfig(), {
      operation: "status",
    });
    expect(result.ok).toBe(true);
    expect((result.data as { operation?: string }).operation).toBe("status");
  });

  it("removes the temporary args/result files after a run", async () => {
    const tmpDir = join(tmpRoot, "work", "tmp");
    await runKeyShotSerialized(makeConfig({ tmpDir }), { operation: "status" });
    const leftovers = readdirSync(tmpDir);
    expect(leftovers).toEqual([]);
  });

  it("returns a structured failure and recovers after temporary storage fails", async () => {
    const blocked = join(tmpRoot, "blocked-temporary-root");
    writeFileSync(blocked, "keep");
    const result = await runKeyShotSerialized(makeConfig({ tmpDir: blocked }), {
      operation: "status",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(
      (await runKeyShotSerialized(makeConfig(), { operation: "status" })).ok,
    ).toBe(true);
  });

  it("reports a local failure when the headless exe is missing", async () => {
    const result = await runKeyShotSerialized(
      makeConfig({ keyshotHeadlessExe: join(tmpRoot, "nope.exe") }),
      {
        operation: "status",
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("isolates each request and restricts POSIX temporary file permissions", async () => {
    const result = await runKeyShotSerialized(makeConfig(), {
      operation: "status",
      inspectTemporaryFiles: true,
    });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ isolated: true });
    if (process.platform !== "win32") {
      expect(result.data).toMatchObject({
        directoryMode: 0o700,
        argsMode: 0o600,
      });
    }
    expect(readdirSync(makeConfig().tmpDir)).toEqual([]);
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
      makeConfig({
        keyshotHeadlessExe: "definitely-not-a-keyshot-command-042",
      }),
      { operation: "status" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Could not start KeyShot headless");
  });

  it("rejects existing product outputs unless overwrite is enabled", async () => {
    const outputDir = join(tmpRoot, "protected-outputs");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "product.bip"), "existing");
    const sourcePath = join(tmpRoot, "source.bip");
    writeFileSync(sourcePath, "scene");
    const result = await runKeyShotSerialized(
      makeConfig({ keyshotOutputDir: outputDir }),
      {
        operation: "product_render",
        scenePath: sourcePath,
        outputScenePath: "product.bip",
        outputPath: "product.png",
        overwrite: false,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Output already exists");
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

  it.each<KeyShotOperation>([
    "render",
    "import_model",
    "apply_material",
    "set_camera",
    "set_standard_camera",
    "set_environment",
    "save_scene",
  ])(
    "protects existing outputs for %s before starting KeyShot",
    async (operation) => {
      const outputDir = join(tmpRoot, `protect-${operation}`);
      mkdirSync(outputDir, { recursive: true });
      const output = join(outputDir, "existing.bip");
      writeFileSync(output, "keep");
      const result = await runKeyShotSerialized(
        makeConfig({ keyshotOutputDir: outputDir }),
        {
          operation,
          [operation === "render" ? "outputPath" : "outputScenePath"]: output,
        },
      );
      expect(result.errorCode).toBe("OUTPUT_EXISTS");
      expect(result.keyshotStdoutTail).toBe("");
    },
  );

  it("rejects input replacement even when external output and overwrite are enabled", async () => {
    const input = join(tmpRoot, "original-input.bip");
    writeFileSync(input, "original");
    const result = await runKeyShotSerialized(
      makeConfig({ keyshotAllowExternalOutputs: true }),
      {
        operation: "save_scene",
        scenePath: input,
        outputScenePath: input,
        overwrite: true,
      },
    );
    expect(result.errorCode).toBe("OUTPUT_IS_INPUT");
  });

  it("allows an intentional overwrite of a distinct output", async () => {
    const output = join(tmpRoot, "outputs", "replace.bip");
    writeFileSync(output, "copy");
    const result = await runKeyShotSerialized(makeConfig(), {
      operation: "save_scene",
      outputScenePath: output,
      overwrite: true,
    });
    expect(result.ok).toBe(true);
  });

  it("does not let an earlier queue job overwrite a later job's input", async () => {
    const first = join(tmpRoot, "outputs", "first-job.bip");
    const later = join(tmpRoot, "outputs", "later-job.bip");
    writeFileSync(first, "first");
    writeFileSync(later, "later");
    const result = await runRenderQueue(makeConfig(), [
      { scenePath: first, outputPath: later, overwrite: true },
      { scenePath: later, outputPath: "later.png" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.data).toMatchObject({
      failed: 1,
      skipped: 1,
      results: [
        { error: expect.stringContaining("Output must not replace an input") },
        { skipped: true },
      ],
    });
  });

  it("times out a long-running process", async () => {
    const result = await spawnWithTimeout(
      process.execPath,
      ["-e", "setTimeout(() => {}, 30000)"],
      50,
    );
    expect(result.timedOut).toBe(true);
  });

  it("bounds captured stdout and stderr", async () => {
    const result = await spawnWithTimeout(
      process.execPath,
      [
        "-e",
        "process.stdout.write('x'.repeat(100000));process.stderr.write('y'.repeat(100000))",
      ],
      30000,
    );
    expect(result.stdout.length).toBe(MAX_CAPTURE_CHARS);
    expect(result.stderr.length).toBe(MAX_CAPTURE_CHARS);
  });
});
