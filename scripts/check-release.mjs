import fs from "node:fs";

const expected = process.argv[2] || process.env.RELEASE_VERSION;
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const server = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const versionSource = fs.readFileSync(new URL("../src/version.ts", import.meta.url), "utf8");
const runtimeVersion = versionSource.match(/VERSION\s*=\s*["']([^"']+)["']/)?.[1];
const versions = [pkg.version, server.version, server.packages?.[0]?.version, runtimeVersion];

if (expected && versions.some((version) => version !== expected)) {
  throw new Error(`Release version mismatch. Expected ${expected}; found ${versions.join(", ")}.`);
}
if (new Set(versions).size !== 1) {
  throw new Error(`Version fields do not match: ${versions.join(", ")}.`);
}
if (pkg.mcpName !== server.name) {
  throw new Error(`package.json mcpName (${pkg.mcpName}) must match server.json name (${server.name}).`);
}
if (server.packages?.[0]?.identifier !== pkg.name) {
  throw new Error("server.json npm package identifier must match package.json name.");
}

console.log(`Release metadata is consistent for ${pkg.name}@${pkg.version}.`);
