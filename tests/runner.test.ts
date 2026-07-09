import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { runKeyShotSerialized } from "../src/runner.js";

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
    keyshotLicenseArgs: [mjsPath],
    keyshotTimeoutMs: 30000,
    tmpDir: join(tmpRoot, "work", "tmp"),
    bridgeScriptPath: mjsPath,
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
});
