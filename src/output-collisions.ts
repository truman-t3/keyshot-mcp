import fs from "node:fs/promises";
import path from "node:path";
import type { KeyShotRequest } from "./types.js";

const PRODUCT_OUTPUT_FIELDS = ["outputScenePath", "outputPath", "outputDir"] as const;
type ProductOutputField = typeof PRODUCT_OUTPUT_FIELDS[number];

export async function allocateAutomaticProductOutputs(request: KeyShotRequest): Promise<KeyShotRequest> {
  const configured = Array.isArray(request._automaticOutputFields) ? request._automaticOutputFields : [];
  const automatic = new Set(
    configured.filter((field): field is ProductOutputField =>
      PRODUCT_OUTPUT_FIELDS.includes(field as ProductOutputField)),
  );

  const result = { ...request };
  delete result._automaticOutputFields;
  if (result.overwrite === true || automatic.size === 0) return result;

  for (let sequence = 1; sequence < 10_000; sequence += 1) {
    const candidates = new Map<ProductOutputField, string>();
    for (const field of automatic) {
      const value = result[field];
      if (typeof value === "string") candidates.set(field, numberedPath(value, field, sequence));
    }
    const occupied = await Promise.all([...candidates.values()].map(exists));
    if (occupied.some(Boolean)) continue;
    for (const [field, value] of candidates) result[field] = value;
    return result;
  }

  throw new Error("Could not find an available automatic output name after 9999 attempts.");
}

function numberedPath(value: string, field: ProductOutputField, sequence: number): string {
  if (sequence === 1) return value;
  if (field === "outputDir") return `${value}-${sequence}`;
  const parsed = path.parse(value);
  return path.join(parsed.dir, `${parsed.name}-${sequence}${parsed.ext}`);
}

async function exists(value: string): Promise<boolean> {
  try {
    await fs.lstat(value);
    return true;
  } catch {
    return false;
  }
}
