import type { ServerConfig } from "./config.js";
import { runKeyShotSerialized } from "./runner.js";
import type { KeyShotRequest, KeyShotResult } from "./types.js";

export type RenderJob = {
  scenePath: string;
  outputPath?: string;
  camera?: string;
  width?: number;
  height?: number;
  samples?: number;
  maxTimeSeconds?: number;
  format?: string;
};

export type RenderQueueOptions = {
  continueOnError?: boolean;
};

export type RenderJobResult = {
  index: number;
  scenePath: string;
  camera?: string;
  ok: boolean;
  outputFiles: string[];
  error: string | null;
  skipped?: boolean;
};

// Injectable runner so the queue can be unit tested without KeyShot.
export type RunFn = (config: ServerConfig, request: KeyShotRequest) => Promise<KeyShotResult>;

/**
 * Run several render jobs one after another.
 *
 * Jobs execute sequentially (the underlying runner is already serialized, and a
 * single KeyShot instance cannot render in parallel). By default the queue stops
 * at the first failure; pass continueOnError to render every remaining job and
 * collect all outcomes. Jobs that are skipped after an early stop are reported
 * with skipped: true so the caller can see exactly what ran.
 */
export async function runRenderQueue(
  config: ServerConfig,
  jobs: RenderJob[],
  options: RenderQueueOptions = {},
  runFn: RunFn = runKeyShotSerialized,
): Promise<KeyShotResult> {
  const continueOnError = options.continueOnError ?? false;
  const results: RenderJobResult[] = [];
  const outputFiles: string[] = [];
  const warnings: string[] = [];
  let succeeded = 0;
  let failed = 0;
  let stopped = false;

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];

    if (stopped) {
      results.push({
        index,
        scenePath: job.scenePath,
        camera: job.camera,
        ok: false,
        outputFiles: [],
        error: null,
        skipped: true,
      });
      continue;
    }

    const result = await runFn(config, { operation: "render", ...job });
    results.push({
      index,
      scenePath: job.scenePath,
      camera: job.camera,
      ok: result.ok,
      outputFiles: result.outputFiles ?? [],
      error: result.error ?? null,
    });

    if (result.ok) {
      succeeded += 1;
      outputFiles.push(...(result.outputFiles ?? []));
    } else {
      failed += 1;
      if (result.error) warnings.push(`Job ${index} failed: ${result.error}`);
      if (!continueOnError) stopped = true;
    }
  }

  const skipped = results.filter((entry) => entry.skipped).length;

  return {
    ok: failed === 0,
    data: {
      total: jobs.length,
      succeeded,
      failed,
      skipped,
      continueOnError,
      results,
    },
    outputFiles,
    warnings,
    keyshotStdoutTail: "",
    error: failed === 0 ? null : `${failed} of ${jobs.length} render job(s) failed.`,
  };
}
