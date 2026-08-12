import fs from "node:fs";

const expected = process.argv[2] || process.env.RELEASE_VERSION;
const pkg = readJson("../package.json");
const server = readJson("../server.json");
const glama = readJson("../glama.json");
const versionSource = readText("../src/version.ts");
const readmeSource = readText("../README.md");
const skillSource = readText("../skills/keyshot-mcp/SKILL.md");
const changelogSource = readText("../CHANGELOG.md");
const toolsDocSource = readText("../docs/TOOLS.md");
const resultSource = readText("../src/result.ts");
const previewSource = readText("../src/preview.ts");
const logoSource = fs.readFileSync(
  new URL("../assets/logo-lockup.png", import.meta.url),
);
const { TOOL_CATALOG } = await import("../dist/tools/catalog.js");

const runtimeVersion = versionSource.match(
  /VERSION\s*=\s*["']([^"']+)["']/,
)?.[1];
const skillVersion = skillSource.match(/^version:\s*([^\s]+)$/m)?.[1];
const versions = [
  pkg.version,
  server.version,
  server.packages?.[0]?.version,
  runtimeVersion,
  skillVersion,
];

if (expected && versions.some((version) => version !== expected)) {
  throw new Error(
    `Release version mismatch. Expected ${expected}; found ${versions.join(", ")}.`,
  );
}
if (new Set(versions).size !== 1)
  throw new Error(`Version fields do not match: ${versions.join(", ")}.`);
if (pkg.mcpName !== server.name)
  throw new Error("package.json mcpName must match server.json name.");
if (server.packages?.[0]?.identifier !== pkg.name)
  throw new Error("server.json npm identifier must match package.json name.");
if (
  glama.$schema !== "https://glama.ai/mcp/schemas/server.json" ||
  !glama.maintainers?.includes("truman-t3")
) {
  throw new Error("glama.json must identify truman-t3 as a maintainer.");
}
for (const required of ["skills", "docs", "glama.json", "CHANGELOG.md"]) {
  if (!pkg.files?.includes(required))
    throw new Error(`The npm package must include ${required}.`);
}
for (const [name, source] of [
  ["README.md", readmeSource],
  ["SECURITY.md", readText("../SECURITY.md")],
]) {
  if (source.includes("\uFFFD") || source.includes("���"))
    throw new Error(`${name} contains Unicode replacement characters.`);
}
if (
  !readmeSource.includes(`keyshot-mcp@${pkg.version}`) ||
  !readmeSource.includes(`当前正式版本为 \`${pkg.version}\``)
) {
  throw new Error(
    "README installation examples must match the release version.",
  );
}
if (!changelogSource.includes(`## [${pkg.version}]`))
  throw new Error("CHANGELOG.md must include the release version.");
if (
  TOOL_CATALOG.length !== 19 ||
  new Set(TOOL_CATALOG.map((tool) => tool.name)).size !== 19
) {
  throw new Error("The release must contain 19 unique MCP tools.");
}
if (!TOOL_CATALOG.some((tool) => tool.name === "keyshot_preview_render")) {
  throw new Error("keyshot_preview_render is missing from the tool catalog.");
}
if (!TOOL_CATALOG.some((tool) => tool.name === "keyshot_sync_saved_scene")) {
  throw new Error("keyshot_sync_saved_scene is missing from the tool catalog.");
}
for (const tool of TOOL_CATALOG) {
  if (
    !tool.title ||
    !tool.description ||
    !tool.inputSchema ||
    !tool.outputSchema ||
    !tool.annotations
  ) {
    throw new Error(`Incomplete public metadata for ${tool.name}.`);
  }
  if (!toolsDocSource.includes(`### \`${tool.name}\``))
    throw new Error(`docs/TOOLS.md is missing ${tool.name}.`);
}
if (
  !resultSource.includes("structuredContent") ||
  !resultSource.includes('type: "image"')
) {
  throw new Error(
    "MCP responses must preserve structured content and support image content.",
  );
}
for (const marker of [
  "MAX_PREVIEW_BYTES",
  "PNG_SIGNATURE",
  ".keyshot-mcp-preview",
]) {
  if (!previewSource.includes(marker))
    throw new Error(`Preview safety marker ${marker} is missing.`);
}
if (
  logoSource.length < 8 ||
  !logoSource
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
  !readmeSource.includes('src="assets/logo-lockup.png"')
) {
  throw new Error(
    "The release must include and display the KeyShot MCP project logo.",
  );
}
console.log(
  `Release metadata is consistent for ${pkg.name}@${pkg.version} with ${TOOL_CATALOG.length} tools.`,
);

function readText(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}
