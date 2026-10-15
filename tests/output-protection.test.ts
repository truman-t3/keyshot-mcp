import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertOutputFilesSafe, inputFilePaths } from "../src/output-paths.js";
import { localFailure } from "../src/result.js";
import type { KeyShotRequest } from "../src/types.js";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "keyshot-protect-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("output file protection", () => {
  it("collects nested material inputs and queue-protected sources, not output paths", () => {
    expect(
      inputFilePaths({
        scenePath: "source.bip",
        outputScenePath: "copy.bip",
        materialAssignments: [{ materialPath: "finish.mtl" }],
        _protectedInputPaths: ["next-job.bip"],
      }),
    ).toEqual(["source.bip", "finish.mtl", "next-job.bip"]);
  });

  it.each(["outputPath", "outputScenePath"])(
    "rejects existing %s by default",
    async (field) => {
      const output = path.join(root, "已存在.bip");
      await fs.writeFile(output, "keep");
      await expect(
        assertOutputFilesSafe({ operation: "save_scene", [field]: output }),
      ).rejects.toThrow("Output already exists");
      expect(await fs.readFile(output, "utf8")).toBe("keep");
      await expect(
        assertOutputFilesSafe({
          operation: "save_scene",
          [field]: output,
          overwrite: true,
        }),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    "scenePath",
    "modelPath",
    "baseScenePath",
    "materialPath",
    "environmentPath",
    "sourcePath",
  ])("protects %s even with overwrite=true", async (field) => {
    const input = path.join(root, "源文件.bip");
    await fs.writeFile(input, "original");
    await expect(
      assertOutputFilesSafe({
        operation: "save_scene",
        [field]: input,
        outputScenePath: input,
        overwrite: true,
      }),
    ).rejects.toThrow("Output must not replace an input");
    expect(await fs.readFile(input, "utf8")).toBe("original");
  });

  it("protects hard links and nested material sources", async () => {
    const input = path.join(root, "original.mtl");
    const alias = path.join(root, "alias.bip");
    await fs.writeFile(input, "material");
    await fs.link(input, alias);
    await expect(
      assertOutputFilesSafe({
        operation: "product_render",
        materialAssignments: [{ materialPath: input }],
        outputScenePath: alias,
        overwrite: true,
      }),
    ).rejects.toThrow("Output must not replace an input");
  });

  it("protects aliases through directory symlinks or junctions", async () => {
    const sourceDir = path.join(root, "source");
    const aliasDir = path.join(root, "alias");
    await fs.mkdir(sourceDir);
    await fs.symlink(
      sourceDir,
      aliasDir,
      process.platform === "win32" ? "junction" : "dir",
    );
    const input = path.join(sourceDir, "scene.bip");
    await fs.writeFile(input, "source");
    await expect(
      assertOutputFilesSafe({
        operation: "save_scene",
        scenePath: input,
        outputScenePath: path.join(aliasDir, "scene.bip"),
        overwrite: true,
      }),
    ).rejects.toThrow("Output must not replace an input");
  });

  it.skipIf(process.platform !== "win32")(
    "protects Windows case-insensitive input aliases",
    async () => {
      const input = path.join(root, "Scene.bip");
      await fs.writeFile(input, "source");
      await expect(
        assertOutputFilesSafe({
          operation: "save_scene",
          scenePath: input,
          outputScenePath: input.toUpperCase(),
          overwrite: true,
        }),
      ).rejects.toThrow("Output must not replace an input");
    },
  );

  it("rejects overlapping image and scene outputs before either exists", async () => {
    const output = path.join(root, "same.bip");
    await expect(
      assertOutputFilesSafe({
        operation: "product_render",
        outputScenePath: output,
        outputPath: output,
        overwrite: true,
      }),
    ).rejects.toThrow("Output paths must refer to different files");
  });

  it("does not treat overwrite=true as permission to replace a directory", async () => {
    await expect(
      assertOutputFilesSafe({
        operation: "save_scene",
        outputScenePath: root,
        overwrite: true,
      }),
    ).rejects.toThrow("is a directory");
  });

  it("rejects directory aliases even when overwrite is enabled", async () => {
    const alias = path.join(root, "directory.bip");
    await fs.symlink(
      root,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      assertOutputFilesSafe({
        operation: "save_scene",
        outputScenePath: alias,
        overwrite: true,
      }),
    ).rejects.toThrow("is a directory");
  });

  it("returns actionable structured error categories", () => {
    expect(
      localFailure("Output must not replace an input file: source.bip")
        .errorCode,
    ).toBe("OUTPUT_IS_INPUT");
    expect(
      localFailure("Output paths must refer to different files: same.bip")
        .errorCode,
    ).toBe("OUTPUT_CONFLICT");
  });
});
