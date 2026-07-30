import fs from "node:fs/promises";
import type { KeyShotResult } from "./types.js";

export async function toolResponse(result: KeyShotResult) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  > = [
    {
      type: "text",
      text: JSON.stringify(stripPrivateImageFields(result), null, 2),
    },
  ];

  if (result.ok && result.imagePath) {
    try {
      content.push({
        type: "image",
        data: await fs.readFile(result.imagePath, "base64"),
        mimeType: result.imageMimeType ?? "image/png",
      });
    } catch (error) {
      result.warnings.push(`Could not read Live snapshot image: ${errorMessage(error)}`);
      content[0] = { type: "text", text: JSON.stringify(stripPrivateImageFields(result), null, 2) };
    } finally {
      if (result.deleteImageAfterRead) await fs.rm(result.imagePath, { force: true }).catch(() => undefined);
    }
  }

  return {
    content,
    isError: !result.ok,
  };
}

function stripPrivateImageFields(result: KeyShotResult): KeyShotResult {
  const copy = { ...result };
  delete copy.imagePath;
  delete copy.imageMimeType;
  delete copy.deleteImageAfterRead;
  return copy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  if (normalized.includes("live companion") || normalized.includes("live bridge")) {
    return {
      errorCode: "LIVE_NOT_CONNECTED",
      suggestions: [
        "Open KeyShot, then run 'Start KeyShot MCP Live' from the KeyShot Scripts list.",
        "Run 'keyshot-mcp live-status' to inspect the local Live Companion connection.",
      ],
    };
  }
  return {
    errorCode: "KEYSHOT_OPERATION_FAILED",
    suggestions: ["Review the error and KeyShot output, then retry with simpler settings or run keyshot_status."],
  };
}
