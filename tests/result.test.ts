import { describe, expect, it } from "vitest";
import { localFailure, toolResponse } from "../src/result.js";

describe("localFailure", () => {
  it("produces a well-formed failure result", () => {
    const result = localFailure("boom");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("boom");
    expect(result.outputFiles).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("merges extra fields", () => {
    const result = localFailure("boom", { warnings: ["careful"], data: { a: 1 } });
    expect(result.warnings).toEqual(["careful"]);
    expect(result.data).toEqual({ a: 1 });
  });
});

describe("toolResponse", () => {
  it("marks the response as an error when the result is not ok", () => {
    const response = toolResponse(localFailure("nope"));
    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0].text).error).toBe("nope");
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
  });
});
