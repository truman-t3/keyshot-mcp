import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "../dist/config.js";
import { loadMaterialPresets, findMaterialPreset } from "../dist/presets.js";
import { runKeyShotSerialized } from "../dist/runner.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = getConfig();
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 2 && args[0] === "--material-file"),
  "Usage: smoke:keyshot:materials [--material-file <native KeyShot MTL>]",
);
const nativeMaterialFile = args[1] ? path.resolve(args[1]) : undefined;
if (nativeMaterialFile) assert.ok((await fs.stat(nativeMaterialFile)).isFile());
const output = `material-smoke-${randomUUID()}/材质验证`;
const modelPath = path.join(root, "examples/demo/keyshot-mcp-cube.obj");
const sourceHash = await hash(modelPath);
const checks = [];

async function run(label, request) {
  process.stdout.write(`${label}... `);
  const result = await runKeyShotSerialized(config, request);
  assert.equal(result.ok, true, result.error ?? label);
  process.stdout.write("ok\n");
  return result;
}

const imported = await run("Import generated cube / 导入测试立方体", {
  operation: "import_model",
  modelPath,
  outputScenePath: `${output}/source.bip`,
  centerGeometry: true,
  snapToGround: true,
  adjustCameraLookAt: true,
  adjustEnvironment: true,
});
let scenePath = imported.outputFiles[0];
assert.ok(scenePath);
const sourceSceneHash = await hash(scenePath);
const inspected = await run("Inspect objects / 读取对象", {
  operation: "inspect_scene",
  scenePath,
});
const target = inspected.data?.objects?.find(
  (object) => object.path && object.children === 0,
);
assert.ok(target?.path, "No leaf object available for material testing");
const presets = await loadMaterialPresets(config);

const cases = [
  "Clear Glass",
  "Matte Black Plastic",
  ...(nativeMaterialFile ? ["Native KeyShot MTL"] : []),
];
for (const [index, label] of cases.entries()) {
  const preset =
    label === "Native KeyShot MTL" ? null : findMaterialPreset(presets, label);
  assert.ok(preset || nativeMaterialFile, `Missing preset: ${label}`);
  const result = await run(`Apply ${label} / 应用材质`, {
    operation: "apply_material",
    scenePath,
    objectPath: target.path,
    ...(preset
      ? { materialName: preset.materialName, presetName: preset.name }
      : { materialPath: nativeMaterialFile }),
    outputScenePath: `${output}/material-${index + 1}.bip`,
  });
  const applied = result.data?.appliedMaterial;
  const requested = preset?.materialName ?? result.data?.material;
  assert.equal(typeof requested, "string");
  assert.ok(
    applied === requested || applied?.startsWith(`${requested} #`),
    `Unexpected assignment: ${applied}`,
  );
  scenePath = result.outputFiles[0];
  assert.ok(scenePath);
  const reopened = await run(`Reopen ${label} / 保存后复查`, {
    operation: "inspect_scene",
    scenePath,
  });
  const actual = reopened.data?.objects?.find(
    (object) => object.path === target.path,
  )?.material;
  assert.equal(
    actual,
    applied,
    "Saved scene does not contain the reported material",
  );
  checks.push({ name: label, material: applied, reopened: true });
}

const previousHash = await hash(scenePath);
const unsupportedOutput = `${output}/unsupported-file.bip`;
const unsupported = await runKeyShotSerialized(config, {
  operation: "apply_material",
  scenePath,
  objectPath: target.path,
  materialPath: path.join(root, "examples/demo/unsupported-wavefront.mtl"),
  outputScenePath: unsupportedOutput,
});
assert.equal(
  unsupported.ok,
  false,
  "Wavefront companion MTL must not be accepted as a native material",
);
assert.equal(unsupported.errorCode, "MATERIAL_FILE_INVALID");
assert.deepEqual(unsupported.outputFiles, []);
await assert.rejects(
  fs.stat(path.join(config.keyshotOutputDir, unsupportedOutput)),
  { code: "ENOENT" },
);
const invalidOutput = `${output}/invalid-material.bip`;
const invalid = await runKeyShotSerialized(config, {
  operation: "apply_material",
  scenePath,
  objectPath: target.path,
  materialName: `MCP Missing Material ${randomUUID()}`,
  outputScenePath: invalidOutput,
});
assert.equal(invalid.ok, false, "Unknown material must fail");
assert.equal(invalid.errorCode, "MATERIAL_NOT_FOUND");
assert.deepEqual(invalid.outputFiles, []);
await assert.rejects(
  fs.stat(path.join(config.keyshotOutputDir, invalidOutput)),
  { code: "ENOENT" },
);
assert.equal(
  await hash(scenePath),
  previousHash,
  "Material failure modified its input scene",
);
assert.equal(
  await hash(imported.outputFiles[0]),
  sourceSceneHash,
  "An operation modified the imported source scene",
);
assert.equal(
  await hash(modelPath),
  sourceHash,
  "An operation modified the source model",
);
console.log(
  "Unknown material rejected; source files preserved / 错误材质已拒绝，源文件未改变",
);
console.log(
  JSON.stringify(
    {
      checks,
      nativeFileCheck: nativeMaterialFile
        ? "passed"
        : "skipped: provide --material-file",
      unsupportedFileRejected: true,
      invalidMaterialRejected: true,
      sourcePreserved: true,
      scenePath,
    },
    null,
    2,
  ),
);

async function hash(filename) {
  return createHash("sha256")
    .update(await fs.readFile(filename))
    .digest("hex");
}
