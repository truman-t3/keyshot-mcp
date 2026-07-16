// Stand-in for keyshot_headless.exe used only by the test suite.
// It reads the last two CLI args (argsPath, resultPath), echoes the requested
// operation back as a success result, and exits 0.
import fs from "node:fs";

const resultPath = process.argv[process.argv.length - 1];
const argsPath = process.argv[process.argv.length - 2];
const payload = JSON.parse(fs.readFileSync(argsPath, "utf8"));

if (payload.delayMs) {
  await new Promise((resolve) => setTimeout(resolve, payload.delayMs));
}

fs.writeFileSync(
  resultPath,
  JSON.stringify({
    ok: true,
    data: { operation: payload.operation, echo: "handled by fake keyshot" },
    outputFiles: [],
    warnings: [],
    keyshotStdoutTail: "fake keyshot finished",
    error: null,
  }),
  "utf8",
);

process.exit(0);
