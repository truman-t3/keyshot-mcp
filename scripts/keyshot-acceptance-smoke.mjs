import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { getConfig } from "../dist/config.js";
import { VERSION } from "../dist/version.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 2 && args[0] === "--package-root"),
  "Usage: keyshot-acceptance-smoke.mjs [--package-root <installed package directory>]",
);
const packageRoot = args[1] ? path.resolve(args[1]) : root;
const pkg = JSON.parse(
  await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
);
assert.equal(pkg.name, "keyshot-mcp");
assert.equal(pkg.version, VERSION);
const config = getConfig();
const outputDir = path.join(
  config.keyshotOutputDir,
  `acceptance-${randomUUID()}`,
  "中文路径",
);
await fs.mkdir(outputDir, { recursive: true });
const realOutputDir = await fs.realpath(outputDir);
const modelPath = path.join(packageRoot, "examples/demo/keyshot-mcp-cube.obj");
const modelHash = await hash(modelPath);
const client = new Client({
  name: "keyshot-internal-acceptance",
  version: VERSION,
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(packageRoot, "dist/index.js")],
  env: {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== undefined),
    ),
    KEYSHOT_OUTPUT_DIR: outputDir,
    KEYSHOT_ALLOW_EXTERNAL_OUTPUTS: "false",
  },
  stderr: "pipe",
});
const checks = [];
const protectedFiles = new Map([[modelPath, modelHash]]);
const settings = { width: 320, height: 240, maxTimeSeconds: 2 };

try {
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.version, VERSION);
  assert.equal((await client.listTools()).tools.length, 19);
  const status = await call("keyshot_status", {});
  assert.equal(status.result.data.ready, true);

  const scenes = [];
  const images = [];
  for (let index = 0; index < 3; index++) {
    const product = await call("keyshot_product_render", {
      modelPath,
      qualityPreset: "preview",
      ...settings,
    });
    scenes.push(product.result.data.savedScene);
    images.push(product.result.data.renders[0].outputPath);
  }
  assert.equal(new Set(scenes).size, 3);
  assert.equal(new Set(images).size, 3);
  for (const [index, scene] of scenes.entries()) {
    assert.ok(scene.endsWith(`${index ? `-${index + 1}` : ""}.bip`));
    assert.equal(path.parse(scene).name, path.parse(images[index]).name);
    protectedFiles.set(scene, await hash(scene));
    await verifyPng(images[index]);
  }

  const source = scenes[0];
  const temporary = await call("keyshot_preview_render", {
    scenePath: source,
    ...settings,
  });
  verifyEmbeddedPng(temporary);
  assert.equal(temporary.result.data.preview.saved, false);
  assert.deepEqual(temporary.result.outputFiles, []);
  assert.deepEqual(
    await fs.readdir(path.join(outputDir, ".keyshot-mcp-preview")),
    [],
  );
  const saved = await call("keyshot_preview_render", {
    scenePath: source,
    outputPath: "saved-preview.png",
    ...settings,
  });
  verifyEmbeddedPng(saved);
  const savedPath = saved.result.data.preview.savedPath;
  assert.equal(saved.result.data.preview.saved, true);
  protectedFiles.set(savedPath, await hash(savedPath));
  await verifyPng(savedPath);
  const conflict = await call(
    "keyshot_preview_render",
    { scenePath: source, outputPath: "saved-preview.png", ...settings },
    false,
  );
  assert.equal(conflict.result.errorCode, "OUTPUT_EXISTS");
  assert.deepEqual(conflict.result.outputFiles, []);

  const imported = await call("keyshot_import_model", {
    modelPath,
    baseScenePath: source,
    outputScenePath: "two-objects.bip",
    centerGeometry: false,
    snapToGround: false,
    adjustCameraLookAt: false,
    adjustEnvironment: false,
  });
  const multiScene = imported.result.outputFiles[0];
  protectedFiles.set(multiScene, await hash(multiScene));
  const before = (
    await call("keyshot_inspect_scene", { scenePath: multiScene })
  ).result.data.objects;
  const leaves = before.filter((object) => object.children === 0);
  assert.ok(leaves.length >= 2, "Import did not preserve multiple objects");
  assert.equal(
    new Set(leaves.map((object) => object.path)).size,
    leaves.length,
  );
  const target = leaves[0];
  const duplicates = leaves.filter((object) => object.name === target.name);
  if (duplicates.length > 1) {
    const ambiguous = await call(
      "keyshot_apply_material_preset",
      {
        scenePath: multiScene,
        objectName: target.name,
        presetName: "Matte Black Plastic",
        outputScenePath: "ambiguous.bip",
      },
      false,
    );
    assert.match(ambiguous.result.error, /ambiguous/i);
    assert.deepEqual(ambiguous.result.outputFiles, []);
    await assert.rejects(fs.stat(path.join(outputDir, "ambiguous.bip")), {
      code: "ENOENT",
    });
  }
  const changed = await call("keyshot_apply_material_preset", {
    scenePath: multiScene,
    objectPath: target.path,
    presetName: "matte black plastic",
    outputScenePath: "one-object-changed.bip",
  });
  assert.equal(changed.result.data.presetName, "Matte Black Plastic");
  assert.match(
    changed.result.data.appliedMaterial,
    /^Soft Rough Black(?: #\d+)?$/,
  );
  const changedScene = changed.result.outputFiles[0];
  protectedFiles.set(changedScene, await hash(changedScene));
  const after = (
    await call("keyshot_inspect_scene", { scenePath: changedScene })
  ).result.data.objects;
  assert.equal(
    after.find((object) => object.path === target.path)?.material,
    changed.result.data.appliedMaterial,
  );
  for (const other of leaves.slice(1)) {
    assert.equal(
      after.find((object) => object.path === other.path)?.material,
      other.material,
      "An untargeted object's material changed",
    );
  }

  const camera = await call("keyshot_apply_camera_preset", {
    scenePath: source,
    presetName: "Front",
    cameraName: "Acceptance Front",
    outputScenePath: "two-cameras.bip",
  });
  const cameraScene = camera.result.outputFiles[0];
  protectedFiles.set(cameraScene, await hash(cameraScene));
  const all = await call("keyshot_render_all_cameras", {
    scenePath: cameraScene,
    outputDir: "all-cameras",
    continueOnError: true,
    ...settings,
  });
  assert.equal(all.result.data.failed, 0);
  assert.ok(all.result.data.succeeded >= 2);
  assert.ok(all.result.data.cameras.includes("Acceptance Front"));
  assert.ok(all.result.data.cameras.includes("Product Hero"));
  for (const file of all.result.outputFiles) await verifyPng(file);

  const queue = await call(
    "keyshot_render_queue",
    {
      continueOnError: true,
      jobs: ["Acceptance Front", "MCP Missing Camera", "Product Hero"].map(
        (camera, index) => ({
          scenePath: cameraScene,
          camera,
          outputPath: `queue-${index + 1}.png`,
          ...settings,
        }),
      ),
    },
    false,
  );
  assert.equal(queue.result.data.succeeded, 2);
  assert.equal(queue.result.data.failed, 1);
  assert.equal(queue.result.data.skipped, 0);
  assert.deepEqual(
    queue.result.data.results.map((job) => job.ok),
    [true, false, true],
  );
  assert.match(queue.result.data.results[1].error, /Camera not found/);
  assert.equal(queue.result.outputFiles.length, 2);
  for (const file of queue.result.outputFiles) await verifyPng(file);
  await assert.rejects(fs.stat(path.join(outputDir, "queue-2.png")), {
    code: "ENOENT",
  });
  for (const [file, beforeHash] of protectedFiles)
    assert.equal(
      await hash(file),
      beforeHash,
      "A protected source was modified",
    );
  console.log(
    JSON.stringify({
      version: VERSION,
      calls: checks.length,
      numberedRuns: scenes.length,
      objects: leaves.length,
      duplicateNameGuard: duplicates.length > 1 ? "passed" : "not reproduced",
      presetName: changed.result.data.presetName,
      cameras: all.result.data.succeeded,
      queue: { succeeded: 2, failed: 1, skipped: 0 },
      sourcePreserved: true,
      temporaryPreviewCleaned: true,
    }),
  );
} finally {
  await client.close();
  await transport.close();
}

async function call(name, args, ok = true) {
  const response = await client.callTool({ name, arguments: args });
  const result = response.structuredContent;
  assert.ok(result, `${name} did not return structured content`);
  assert.equal(
    result.ok,
    ok,
    `${name}: ${result.error ?? "unexpected result"}`,
  );
  const text = response.content.find((item) => item.type === "text");
  assert.ok(text);
  assert.deepEqual(JSON.parse(text.text), result);
  for (const file of result.outputFiles) {
    const relative = path.relative(realOutputDir, await fs.realpath(file));
    assert.ok(!path.isAbsolute(relative) && !relative.startsWith(".."));
  }
  checks.push(name);
  console.log(
    `${checks.length}. ${name}: ${ok ? "ok / 通过" : "expected failure / 预期失败"}`,
  );
  return { result, content: response.content };
}

function verifyEmbeddedPng(response) {
  const image = response.content.find((item) => item.type === "image");
  assert.equal(image?.mimeType, "image/png");
  const bytes = Buffer.from(image.data, "base64");
  assert.equal(response.result.data.preview.bytes, bytes.length);
  assert.equal(response.result.data.preview.imageEmbedded, true);
  checkPng(bytes);
}

function checkPng(bytes) {
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.equal(bytes.readUInt32BE(16), settings.width);
  assert.equal(bytes.readUInt32BE(20), settings.height);
  assert.ok(bytes.length > 1000 && bytes.length <= 8 * 1024 * 1024);
}

async function verifyPng(file) {
  checkPng(await fs.readFile(file));
}

async function hash(file) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}
