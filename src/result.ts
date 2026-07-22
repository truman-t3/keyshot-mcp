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
  const guidance = classifyError(error);
  return {
    ok: false,
    data: extra?.data ?? null,
    outputFiles: extra?.outputFiles ?? [],
    warnings: extra?.warnings ?? [],
    keyshotStdoutTail: extra?.keyshotStdoutTail ?? "",
    error,
    errorCode: extra?.errorCode ?? guidance.errorCode,
    suggestions: extra?.suggestions ?? guidance.suggestions,
  };
}

export function withErrorGuidance(result: KeyShotResult): KeyShotResult {
  if (result.ok || !result.error) return result;
  const guidance = classifyError(result.error);
  return {
    ...result,
    errorCode: result.errorCode ?? guidance.errorCode,
    suggestions: result.suggestions ?? guidance.suggestions,
  };
}

function classifyError(error: string): { errorCode: string; suggestions: string[] } {
  const normalized = error.toLowerCase();
  if (
    normalized.includes("headless executable not found") ||
    (normalized.includes("path command") && normalized.includes("not found"))
  ) {
    return {
      errorCode: "KEYSHOT_NOT_FOUND",
      suggestions: ["Set KEYSHOT_HEADLESS_EXE to the full path of keyshot_headless.exe, then restart the MCP client."],
    };
  }
  if (normalized.includes("license") || normalized.includes("activation")) {
    return {
      errorCode: "LICENSE_UNAVAILABLE",
      suggestions: ["Open KeyShot normally and confirm that its local license is active, then retry."],
    };
  }
  if (normalized.includes("could not start keyshot")) {
    return {
      errorCode: "KEYSHOT_START_FAILED",
      suggestions: ["Check the KeyShot executable path and start KeyShot normally once before retrying headless mode."],
    };
  }
  if (normalized.includes("timed out")) {
    return {
      errorCode: "KEYSHOT_TIMEOUT",
      suggestions: ["Try the preview quality preset or increase KEYSHOT_TIMEOUT_MS for a long render."],
    };
  }
  if (normalized.includes("output already exists") || normalized.includes("overwrite is false")) {
    return {
      errorCode: "OUTPUT_EXISTS",
      suggestions: ["Choose another explicit output name or set overwrite=true only when replacement is intentional."],
    };
  }
  if (normalized.includes("output path must stay inside")) {
    return {
      errorCode: "OUTPUT_OUTSIDE_ALLOWED_DIRECTORY",
      suggestions: ["Use a path inside KEYSHOT_OUTPUT_DIR, or explicitly enable external outputs if that location is trusted."],
    };
  }
  if (
    normalized.includes("scene file not found") ||
    normalized.includes("model file not found") ||
    normalized.includes("base scene file not found")
  ) {
    return {
      errorCode: "INPUT_NOT_FOUND",
      suggestions: ["Check that the input file still exists and provide its full local path."],
    };
  }
  if (normalized.includes("preset not found")) {
    return {
      errorCode: "PRESET_NOT_FOUND",
      suggestions: ["List the available presets first, then retry with one of the returned names."],
    };
  }
  if (normalized.includes("unsupported")) {
    return {
      errorCode: "UNSUPPORTED_KEYSHOT_API",
      suggestions: ["This KeyShot version does not expose the required headless API; use a supported option or verify a newer KeyShot release."],
    };
  }
  return {
    errorCode: "KEYSHOT_OPERATION_FAILED",
    suggestions: ["Review the error and KeyShot output, then retry with simpler settings or run keyshot_status."],
  };
}
