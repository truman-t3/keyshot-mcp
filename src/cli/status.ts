import { getConfig } from "../config.js";
import { runKeyShotDiagnostics } from "../diagnostics.js";

const result = await runKeyShotDiagnostics(getConfig());
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
