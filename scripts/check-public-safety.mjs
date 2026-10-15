import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const rules = [
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{30,255})\b/g,
  ],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,255}\b/g],
  ["API key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,255}\b/g],
  ["AWS access ID", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["credential-bearing URL", /https?:\/\/[^\s/"']+:[^\s/@"']+@[^\s"']+/g],
  [
    "personal home path",
    /[A-Z]:[\\/]{1,2}Users[\\/]{1,2}(?!Public\b|Default\b|<|\$|YOUR_|YourName\b|username\b|user\b|you\b)[^\\/\s"'<>]+/gi,
  ],
  [
    "machine-specific KeyShot installation",
    /[A-Z]:[\\/]{1,2}keyshot\d{4}_\d+[\\/]/gi,
  ],
  ["clipboard attachment name", /codex-clipboard-[a-f0-9-]{20,}/gi],
];
const reviewedImages = new Set([
  "assets/logo-lockup.png",
  "assets/demo/keyshot-mcp-demo.png",
  "assets/demo/lantern/brass.png",
  "assets/demo/lantern/steel.png",
]);

export function scanPublicText(text) {
  const findings = [];
  for (const [category, rule] of rules) {
    for (const match of text.matchAll(rule)) {
      findings.push({
        category,
        line: text.slice(0, match.index).split("\n").length,
      });
    }
  }
  return findings;
}

export function unsafePublicFilename(file) {
  const normalized = file.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  if (
    /\.(?:png|jpe?g|webp|gif|tiff?|bmp)$/i.test(normalized) &&
    !reviewedImages.has(normalized)
  )
    return true;
  if (
    /\.(?:bip|ksp|lic|pem|key|p12|pfx|log|blend|fbx|step|stp|3dm|c4d|psd|zip|7z)$/i.test(
      normalized,
    )
  )
    return true;
  if (/(?:^|\/)\.(?:npmrc|pypirc)$/.test(lower)) return true;
  if (/(?:^|\/)\.env(?:\..*)?$/.test(lower) && !/\.example$/.test(lower))
    return true;
  if (lower.startsWith("work/")) return true;
  if (lower.startsWith("outputs/") && normalized !== "outputs/.gitkeep")
    return true;
  if (
    /\.(?:obj|mtl|gltf|glb|hdr|hdri|exr)$/i.test(normalized) &&
    ![
      "examples/demo/keyshot-mcp-cube.obj",
      "examples/demo/unsupported-wavefront.mtl",
    ].includes(normalized)
  )
    return true;
  return false;
}

export function scanPngMetadata(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature))
    throw new Error("Invalid PNG signature");
  const findings = [];
  let ended = false;
  for (let offset = 8; offset + 12 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    if (offset + 12 + length > buffer.length)
      throw new Error("Truncated PNG chunk");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (offset === 8 && (type !== "IHDR" || length !== 13))
      throw new Error("Invalid PNG header");
    let data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "zTXt")
      data = inflateSync(data.subarray(data.indexOf(0) + 2), {
        maxOutputLength: 1024 * 1024,
      });
    if (type === "iTXt") {
      const end = data.indexOf(0);
      const compressed = data[end + 1] === 1;
      let start = data.indexOf(0, end + 3) + 1;
      start = data.indexOf(0, start) + 1;
      data = data.subarray(start);
      if (compressed)
        data = inflateSync(data, { maxOutputLength: 1024 * 1024 });
    }
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) {
      findings.push(...scanPublicText(data.toString("utf8")));
      if (type === "eXIf") {
        findings.push(...scanPublicText(data.toString("utf16le")));
        const swapped = Buffer.from(
          data.subarray(0, data.length - (data.length % 2)),
        );
        findings.push(...scanPublicText(swapped.swap16().toString("utf16le")));
      }
    }
    offset += length + 12;
    if (type === "IEND") {
      if (length !== 0 || offset !== buffer.length)
        throw new Error("Invalid PNG end or trailing content");
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error("Missing PNG end chunk");
  return findings;
}

export function checkPublicSafety(root) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const findings = [];
  for (const file of new Set(files)) {
    const filenameFindings = scanPublicText(file);
    if (filenameFindings.length) {
      findings.push(...filenameFindings.map((item) => ({ file, ...item })));
      continue;
    }
    if (unsafePublicFilename(file)) {
      findings.push({
        file,
        category: "private/generated asset filename",
        line: 0,
      });
      continue;
    }
    const absolute = path.join(root, file);
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.size > 16 * 1024 * 1024
    ) {
      findings.push({
        file,
        category: "linked, non-file or oversized publication entry",
        line: 0,
      });
      continue;
    }
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0) && !file.toLowerCase().endsWith(".png")) {
      findings.push({
        file,
        category: "unreviewed binary publication content",
        line: 0,
      });
      continue;
    }
    const matches = file.toLowerCase().endsWith(".png")
      ? scanPngMetadata(buffer)
      : buffer.includes(0)
        ? []
        : scanPublicText(buffer.toString("utf8"));
    findings.push(...matches.map((item) => ({ file, ...item })));
  }
  return { fileCount: new Set(files).size, findings };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const report = checkPublicSafety(root);
  if (report.findings.length) {
    for (const finding of report.findings) {
      const safeFile = scanPublicText(finding.file).length
        ? "[redacted filename]"
        : finding.file;
      console.error(
        `${safeFile}:${finding.line}: ${finding.category} [value redacted]`,
      );
    }
    process.exitCode = 1;
  } else
    console.log(
      `Public-content safety check passed (${report.fileCount} files). History and remote alerts require separate review.`,
    );
}
