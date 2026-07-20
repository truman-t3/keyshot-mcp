import { describe, expect, it } from "vitest";
import {
  applyMaterialInputSchema,
  applyMaterialSchema,
  applyMaterialPresetSchema,
  applyCameraPresetSchema,
  batchRenderInputSchema,
  batchRenderSchema,
  importModelSchema,
  listCamerasSchema,
  renderInputSchema,
  renderAllCamerasInputSchema,
  renderAllCamerasSchema,
  renderQueueInputSchema,
  renderQueueSchema,
  renderSchema,
  saveSceneSchema,
  setCameraSchema,
  setEnvironmentSchema,
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

  it("rejects conflicting samples and maxTimeSeconds", () => {
    expect(() => renderInputSchema.parse({ scenePath: "a.bip", samples: 64, maxTimeSeconds: 10 })).toThrow();
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

  it("accepts optional product-placement import controls", () => {
    const parsed = importModelSchema.parse({
      modelPath: "m.obj",
      outputScenePath: "out.bip",
      centerGeometry: true,
      snapToGround: true,
      adjustCameraLookAt: true,
      adjustEnvironment: true,
    });
    expect(parsed.centerGeometry).toBe(true);
    expect(parsed.snapToGround).toBe(true);
  });
});

describe("setCameraSchema", () => {
  const valid = {
    scenePath: "a.bip",
    position: [0, 1, 2],
    lookAt: [0, 0, 0],
    outputScenePath: "out.bip",
  };

  it("requires position and lookAt as a pair", () => {
    expect(() => setCameraSchema.parse({ ...valid, lookAt: undefined } as object)).toThrow();
    expect(() => setCameraSchema.parse({ ...valid, position: undefined } as object)).toThrow();
  });

  it("accepts an optional up vector", () => {
    const parsed = setCameraSchema.parse({ ...valid, up: [0, 1, 0] });
    expect(parsed.up).toEqual([0, 1, 0]);
  });

  it("allows lens-only and distance-only camera updates", () => {
    expect(setCameraSchema.parse({
      scenePath: "a.bip",
      cameraName: "Hero",
      focalLength: 85,
      outputScenePath: "out.bip",
    }).focalLength).toBe(85);
    expect(setCameraSchema.parse({
      scenePath: "a.bip",
      distance: 4,
      outputScenePath: "out.bip",
    }).distance).toBe(4);
  });

  it("rejects conflicting or out-of-range lens controls", () => {
    const base = { scenePath: "a.bip", outputScenePath: "out.bip" };
    expect(() => setCameraSchema.parse({ ...base, fieldOfView: 45, focalLength: 50 })).toThrow();
    expect(() => setCameraSchema.parse({ ...base, fieldOfView: 180 })).toThrow();
    expect(() => setCameraSchema.parse({ ...base, focalLength: 4 })).toThrow();
    expect(() => setCameraSchema.parse(base)).toThrow();
  });
});

describe("setEnvironmentSchema", () => {
  it("accepts rotations from 0 up to but not including 360 degrees", () => {
    const base = { scenePath: "a.bip", outputScenePath: "out.bip" };
    expect(setEnvironmentSchema.parse({ ...base, rotation: 0 }).rotation).toBe(0);
    expect(setEnvironmentSchema.parse({ ...base, rotation: 359.9 }).rotation).toBe(359.9);
    expect(() => setEnvironmentSchema.parse({ ...base, rotation: 360 })).toThrow();
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

  it("rejects conflicting samples and maxTimeSeconds", () => {
    expect(() =>
      batchRenderInputSchema.parse({
        scenePath: "a.bip",
        outputDir: "out",
        cameras: ["Front"],
        samples: 64,
        maxTimeSeconds: 10,
      }),
    ).toThrow();
  });
});

describe("applyCameraPresetSchema", () => {
  it("requires scene, preset, and output scene while allowing a camera name override", () => {
    const parsed = applyCameraPresetSchema.parse({
      scenePath: "a.bip",
      presetName: "Isometric",
      cameraName: "Hero View",
      outputScenePath: "out.bip",
    });
    expect(parsed.cameraName).toBe("Hero View");
    expect(() => applyCameraPresetSchema.parse({ scenePath: "a.bip", presetName: "Front" })).toThrow();
  });
});

describe("renderAllCamerasSchema", () => {
  it("requires a scene and output directory and defaults to continuing on errors", () => {
    const parsed = renderAllCamerasSchema.parse({ scenePath: "a.bip", outputDir: "all-cameras" });
    expect(parsed.continueOnError).toBe(true);
    expect(() => renderAllCamerasSchema.parse({ scenePath: "a.bip" })).toThrow();
  });

  it("rejects conflicting render modes", () => {
    expect(() => renderAllCamerasInputSchema.parse({
      scenePath: "a.bip",
      outputDir: "all-cameras",
      samples: 64,
      maxTimeSeconds: 10,
    })).toThrow();
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

  it("rejects a job with conflicting render modes", () => {
    expect(() =>
      renderQueueInputSchema.parse({
        jobs: [{ scenePath: "a.bip", samples: 64, maxTimeSeconds: 10 }],
      }),
    ).toThrow();
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
