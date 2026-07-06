import { getConfig } from "../config.js";
import { runKeyShotSerialized } from "../runner.js";

const result = await runKeyShotSerialized(getConfig(), { operation: "status" });
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
