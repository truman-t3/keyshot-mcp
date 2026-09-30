import fs from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("Provide a release version, for example 0.13.0.");
}
const changelog = fs.readFileSync(
  new URL("../CHANGELOG.md", import.meta.url),
  "utf8",
);
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) throw new Error(`Missing changelog entry for ${version}.`);
let end = lines.findIndex(
  (line, index) => index > start && line.startsWith("## ["),
);
if (end === -1) end = lines.length;
const notes = lines
  .slice(start + 1, end)
  .join("\n")
  .trim();
if (!notes || !/[\u3400-\u9fff]/u.test(notes) || !/[A-Za-z]/.test(notes)) {
  throw new Error(`Release ${version} requires English and Chinese notes.`);
}
process.stdout.write(`${notes}\n`);
