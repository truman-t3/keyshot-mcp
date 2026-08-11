import { describe, expect, it } from "vitest";
import {
  localFailure,
  toolImageResponse,
  toolResponse,
} from "../src/result.js";

describe("localFailure", () => {
  it("produces a well-formed failure result", () => {
    const result = localFailure("boom");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("boom");
    expect(result.outputFiles).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errorCode).toBe("KEYSHOT_OPERATION_FAILED");
    expect(result.suggestions).toHaveLength(1);
  });

  it("classifies common failures with actionable suggestions", () => {
    expect(
      localFailure("KeyShot headless executable not found: x").errorCode,
    ).toBe("KEYSHOT_NOT_FOUND");
    expect(
      localFailure("Output already exists and overwrite is false").errorCode,
    ).toBe("OUTPUT_EXISTS");
    expect(localFailure("KeyShot timed out after 100ms").errorCode).toBe(
      "KEYSHOT_TIMEOUT",
    );
  });

  it("merges extra fields", () => {
    const result = localFailure("boom", {
      warnings: ["careful"],
      data: { a: 1 },
    });
    expect(result.warnings).toEqual(["careful"]);
    expect(result.data).toEqual({ a: 1 });
  });
});

describe("toolResponse", () => {
  it("marks the response as an error when the result is not ok", () => {
    const result = localFailure("nope");
    const response = toolResponse(result);
    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0].text).error).toBe("nope");
    expect(response.structuredContent).toEqual(result);
  });

  it("does not mark the response as an error when ok", () => {
    const response = toolResponse({
      ok: true,
      data: null,
      outputFiles: [],
      warnings: [],
      keyshotStdoutTail: "",
      error: null,
    });
    expect(response.isError).toBe(false);
    expect(response.structuredContent.ok).toBe(true);
  });
});

describe("toolImageResponse", () => {
  it("keeps JSON compatibility while adding MCP image content", () => {
    const result = {
      ok: true,
      data: { preview: true },
      outputFiles: [],
      warnings: [],
      keyshotStdoutTail: "",
      error: null,
    };
    const response = toolImageResponse(result, "iVBORw0KGgo=");
    expect(response.content[0].type).toBe("text");
    expect(response.content[1]).toEqual({
      type: "image",
      data: "iVBORw0KGgo=",
      mimeType: "image/png",
    });
    expect(response.structuredContent).toEqual(result);
  });
});
