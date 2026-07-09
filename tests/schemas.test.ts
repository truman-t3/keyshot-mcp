import { describe, expect, it } from "vitest";
import {
  applyMaterialInputSchema,
  applyMaterialSchema,
  applyMaterialPresetSchema,
  batchRenderSchema,
  importModelSchema,
  listCamerasSchema,
  renderQueueSchema,
  renderSchema,
  saveSceneSchema,
  setCameraSchema,
} from "../src/schemas.js";

describe("renderSchema", () => {
  it("requires a scenePath", () => {
    expect(() => renderSchema.parse({})).toThrow();
    expect(renderSchema.parse({ scenePath: "a.bip" }).scenePath).toBe("a.bip");
  });

  it("accepts optional camera and dimensions", () => {
    const parsed = renderSchema.parse({ scenePath: "a.bip", camera: "Front", width: 1920, height: 1080 });
    expect(parsed.camera).toBe("Front");
    expect(parsed.width).toBe(1920);
  });
});

describe("importModelSchema", () => {
  it("requires modelPath and outputScenePath", () => {
    expect(() => importModelSchema.parse({ modelPath: "m.obj" })).toThrow();
    expect(() => importModelSchema.parse({ outputScenePath: "out.bip" })).toThrow();
  });

  it("treats baseScenePath as optional", () => {
    const parsed = importModelSchema.parse({ modelPath: "m.obj", outputScenePath: "out.bip" });
    expect(parsed.baseScenePath).toBeUndefined();
    const withBase = importModelSchema.parse({
      modelPath: "m.obj",
      baseScenePath: "base.bip",
      outputScenePath: "out.bip",
    });
    expect(withBase.baseScenePath).toBe("base.bip");
  });
});

describe("setCameraSchema", () => {
  const valid = {
    scenePath: "a.bip",
    position: [0, 1, 2],
    lookAt: [0, 0, 0],
    outputScenePath: "out.bip",
  };

  it("requires position and lookAt", () => {
    expect(() => setCameraSchema.parse({ ...valid, lookAt: undefined } as object)).toThrow();
    expect(() => setCameraSchema.parse({ ...valid, position: undefined } as object)).toThrow();
  });

  it("accepts an optional up vector", () => {
    const parsed = setCameraSchema.parse({ ...valid, up: [0, 1, 0] });
    expect(parsed.up).toEqual([0, 1, 0]);
  });
});

describe("applyMaterialInputSchema", () => {
  it("refuses when neither objectName nor objectPath is given", () => {
    expect(() =>
      applyMaterialSchema.parse({ scenePath: "a.bip", materialName: "Metal", outputScenePath: "o.bip" }),
    ).toThrow();
  });

  it("refuses when neither materialName nor materialPath is given", () => {
    expect(() =>
      applyMaterialSchema.parse({ scenePath: "a.bip", objectName: "Body", outputScenePath: "o.bip" }),
    ).toThrow();
  });

  it("accepts a valid object + material combination", () => {
    const parsed = applyMaterialInputSchema.parse({
      scenePath: "a.bip",
      objectName: "Body",
      materialName: "Brushed Metal",
      outputScenePath: "o.bip",
    });
    expect(parsed.objectName).toBe("Body");
  });
});

describe("batchRenderSchema", () => {
  it("requires at least one camera", () => {
    expect(() =>
      batchRenderSchema.parse({ scenePath: "a.bip", outputDir: "out", cameras: [] }),
    ).toThrow();
  });
});

describe("saveSceneSchema", () => {
  it("requires scenePath and outputScenePath", () => {
    expect(saveSceneSchema.parse({ scenePath: "a.bip", outputScenePath: "o.bip" }).outputScenePath).toBe("o.bip");
  });
});

describe("listCamerasSchema", () => {
  it("requires a scenePath", () => {
    expect(() => listCamerasSchema.parse({})).toThrow();
    expect(listCamerasSchema.parse({ scenePath: "a.bip" }).scenePath).toBe("a.bip");
  });
});

describe("renderQueueSchema", () => {
  it("requires at least one job", () => {
    expect(() => renderQueueSchema.parse({ jobs: [] })).toThrow();
  });

  it("accepts jobs and continueOnError", () => {
    const parsed = renderQueueSchema.parse({
      jobs: [{ scenePath: "a.bip", camera: "Front" }],
      continueOnError: true,
    });
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.continueOnError).toBe(true);
  });

  it("rejects a job without scenePath", () => {
    expect(() => renderQueueSchema.parse({ jobs: [{ camera: "Front" }] })).toThrow();
  });
});

describe("applyMaterialPresetSchema", () => {
  it("requires presetName and an object reference", () => {
    expect(() =>
      applyMaterialPresetSchema.parse({ scenePath: "a.bip", presetName: "Steel", outputScenePath: "o.bip" }),
    ).toThrow();
    const parsed = applyMaterialPresetSchema.parse({
      scenePath: "a.bip",
      presetName: "Steel",
      objectName: "Body",
      outputScenePath: "o.bip",
    });
    expect(parsed.presetName).toBe("Steel");
  });
});
