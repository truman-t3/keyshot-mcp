import { describe, expect, it, vi } from "vitest";
import { runRenderQueue, type RenderJob } from "../src/queue.js";
import type { KeyShotResult } from "../src/types.js";
import type { ServerConfig } from "../src/config.js";

const config = {} as ServerConfig;

function ok(outputFiles: string[]): KeyShotResult {
  return { ok: true, data: {}, outputFiles, warnings: [], keyshotStdoutTail: "", error: null };
}
function fail(error: string): KeyShotResult {
  return { ok: false, data: null, outputFiles: [], warnings: [], keyshotStdoutTail: "", error };
}

const jobs: RenderJob[] = [
  { scenePath: "a.bip", camera: "Cam1", outputPath: "a.png" },
  { scenePath: "b.bip", camera: "Cam2", outputPath: "b.png" },
  { scenePath: "c.bip", camera: "Cam3", outputPath: "c.png" },
];

describe("runRenderQueue", () => {
  it("runs every job when all succeed", async () => {
    const runFn = vi.fn(async (_c, req) => ok([`${(req as any).outputPath}`]));
    const result = await runRenderQueue(config, jobs, {}, runFn);
    expect(runFn).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    expect((result.data as any).succeeded).toBe(3);
    expect(result.outputFiles).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("stops at first failure by default and marks the rest skipped", async () => {
    const runFn = vi.fn(async (_c, req) =>
      (req as any).scenePath === "b.bip" ? fail("boom") : ok(["x.png"]),
    );
    const result = await runRenderQueue(config, jobs, {}, runFn);
    expect(runFn).toHaveBeenCalledTimes(2); // job 3 never runs
    expect(result.ok).toBe(false);
    const data = result.data as any;
    expect(data.succeeded).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.skipped).toBe(1);
    expect(data.results[2].skipped).toBe(true);
  });

  it("continues through failures when continueOnError is set", async () => {
    const runFn = vi.fn(async (_c, req) =>
      (req as any).scenePath === "b.bip" ? fail("boom") : ok(["x.png"]),
    );
    const result = await runRenderQueue(config, jobs, { continueOnError: true }, runFn);
    expect(runFn).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    const data = result.data as any;
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.skipped).toBe(0);
  });

  it("passes the render operation to the runner", async () => {
    const runFn = vi.fn(async () => ok([]));
    await runRenderQueue(config, [jobs[0]], {}, runFn);
    expect(runFn).toHaveBeenCalledWith(config, expect.objectContaining({ operation: "render", scenePath: "a.bip" }));
  });
});
