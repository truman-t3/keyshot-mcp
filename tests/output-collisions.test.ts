import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allocateAutomaticProductOutputs } from "../src/output-collisions.js";

let root: string;

describe("automatic product output allocation", () => {
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "keyshot-output-collisions-"));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("uses one sequence number for the generated scene and image", async () => {
    const scene = path.join(root, "speaker-product.bip");
    const image = path.join(root, "speaker-product.png");
    writeFileSync(scene, "existing");
    writeFileSync(image, "existing");
    writeFileSync(path.join(root, "speaker-product-2.bip"), "existing");

    const result = await allocateAutomaticProductOutputs({
      operation: "product_render",
      outputScenePath: scene,
      outputPath: image,
      _automaticOutputFields: ["outputScenePath", "outputPath"],
    });
    expect(result.outputScenePath).toBe(path.join(root, "speaker-product-3.bip"));
    expect(result.outputPath).toBe(path.join(root, "speaker-product-3.png"));
  });

  it("numbers an automatically generated all-camera directory", async () => {
    const outputDir = path.join(root, "watch-renders");
    mkdirSync(outputDir);
    const result = await allocateAutomaticProductOutputs({
      operation: "product_render",
      outputDir,
      _automaticOutputFields: ["outputDir"],
    });
    expect(result.outputDir).toBe(`${outputDir}-2`);
  });

  it("does not rename explicit outputs or overwrite requests", async () => {
    const explicit = path.join(root, "explicit.bip");
    writeFileSync(explicit, "existing");
    expect((await allocateAutomaticProductOutputs({
      operation: "product_render",
      outputScenePath: explicit,
    })).outputScenePath).toBe(explicit);
    expect((await allocateAutomaticProductOutputs({
      operation: "product_render",
      outputScenePath: explicit,
      overwrite: true,
      _automaticOutputFields: ["outputScenePath"],
    })).outputScenePath).toBe(explicit);
  });
});
