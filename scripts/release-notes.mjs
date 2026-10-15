import fs from "node:fs";
import { extractReleaseNotes } from "./release-changelog.mjs";

const version = process.argv[2];
const changelog = fs.readFileSync(
  new URL("../CHANGELOG.md", import.meta.url),
  "utf8",
);
const notes = extractReleaseNotes(changelog, version);
process.stdout.write(`${notes}\n`);
