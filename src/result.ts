import type { KeyShotResult } from "./types.js";

export function toolResponse(result: KeyShotResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: !result.ok,
  };
}

export function localFailure(error: string, extra?: Partial<KeyShotResult>): KeyShotResult {
  return {
    ok: false,
    data: extra?.data ?? null,
    outputFiles: extra?.outputFiles ?? [],
    warnings: extra?.warnings ?? [],
    keyshotStdoutTail: extra?.keyshotStdoutTail ?? "",
    error,
  };
}
