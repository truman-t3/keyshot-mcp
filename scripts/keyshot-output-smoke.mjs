import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "../dist/config.js";
import { runKeyShotSerialized } from "../dist/runner.js";

const config = getConfig();
const modelPath = fileURLToPath(
  new URL("../examples/demo/keyshot-mcp-cube.obj", import.meta.url),
);
const output = path.join(
  config.keyshotOutputDir,
  `output-smoke-${randomUUID()}`,
  "输出保护",
);
const source = path.join(output, "source.bip");
const copy = path.join(output, "copy.bip");
const image = path.join(output, "preview.png");
const modelHash = await hash(modelPath);
const checks = [];

async function run(label, request, expectedCode) {
  process.stdout.write(`${label}... `);
  const result = await runKeyShotSerialized(config, request);
  if (expectedCode) {
    assert.equal(result.ok, false, `${label} must fail safely`);
    assert.equal(result.errorCode, expectedCode, result.error ?? label);
  } else {
    assert.equal(result.ok, true, result.error ?? label);
  }
  checks.push({ label, ok: true, errorCode: result.errorCode ?? null });
  process.stdout.write("ok\n");
  return result;
}

await run("Import generated cube / 导入测试立方体", {
  operation: "import_model",
  modelPath,
  outputScenePath: source,
  centerGeometry: true,
  snapToGround: true,
  adjustCameraLookAt: true,
});
const sourceHash = await hash(source);
await run("Save a separate scene / 另存场景副本", {
  operation: "save_scene",
  scenePath: source,
  outputScenePath: copy,
});
const copyHash = await hash(copy);
for (const operation of [
  "save_scene",
  "import_model",
  "apply_material",
  "set_camera",
  "set_standard_camera",
  "set_environment",
]) {
  await run(
    `Reject existing ${operation} output / 拒绝已有场景输出`,
    {
      operation,
      scenePath: source,
      modelPath,
      outputScenePath: copy,
    },
    "OUTPUT_EXISTS",
  );
  await run(
    `Protect ${operation} input / 保护输入文件`,
    {
      operation,
      scenePath: source,
      modelPath,
      outputScenePath: source,
      overwrite: true,
    },
    "OUTPUT_IS_INPUT",
  );
}
assert.equal(await hash(copy), copyHash);
await run("Explicitly replace only the copy / 明确覆盖副本", {
  operation: "save_scene",
  scenePath: source,
  outputScenePath: copy,
  overwrite: true,
});
await run("Render a new PNG / 渲染新 PNG", {
  operation: "render",
  scenePath: source,
  outputPath: image,
  width: 320,
  height: 240,
  maxTimeSeconds: 2,
});
const imageHash = await hash(image);
await run(
  "Reject existing render / 拒绝重复图片",
  {
    operation: "render",
    scenePath: source,
    outputPath: image,
  },
  "OUTPUT_EXISTS",
);
assert.equal(await hash(image), imageHash);
await run(
  "Reject rendering over a source / 禁止用渲染覆盖源文件",
  {
    operation: "render",
    scenePath: source,
    outputPath: source,
    overwrite: true,
  },
  "OUTPUT_IS_INPUT",
);
await run("Explicitly replace only the PNG / 明确覆盖输出图片", {
  operation: "render",
  scenePath: source,
  outputPath: image,
  width: 320,
  height: 240,
  maxTimeSeconds: 2,
  overwrite: true,
});
assert.equal(await hash(source), sourceHash, "Input scene changed");
assert.equal(await hash(modelPath), modelHash, "Source OBJ changed");
const png = await fs.readFile(image);
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
const report = { output, sourcePreserved: true, modelPreserved: true, checks };
await fs.writeFile(
  path.join(output, "validation.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(`Output safety verified / 输出保护验证通过: ${output}`);

async function hash(file) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}
