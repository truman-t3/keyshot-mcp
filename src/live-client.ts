import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ServerConfig } from "./config.js";
import { localFailure, withErrorGuidance } from "./result.js";
import type { KeyShotRequest, KeyShotResult } from "./types.js";

export const LIVE_PROTOCOL_VERSION = 1;
export const MAX_LIVE_RESPONSE_BYTES = 2 * 1024 * 1024;

export type LiveDiscovery = {
  protocolVersion: number;
  pid: number;
  port: number;
  token: string;
  startedAt: string;
  keyshotVersion?: string | null;
};

type LiveWireResponse = {
  id: string;
  ok: boolean;
  data?: unknown;
  outputFiles?: string[];
  warnings?: string[];
  error?: string | null;
  imagePath?: string;
  imageMimeType?: string;
  deleteImageAfterRead?: boolean;
};

let liveQueue: Promise<unknown> = Promise.resolve();

export function runLiveSerialized(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  const run = liveQueue.then(() => runLive(config, request));
  liveQueue = run.catch(() => undefined);
  return run;
}

export async function readLiveDiscovery(discoveryPath: string): Promise<LiveDiscovery> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(discoveryPath, "utf8"));
  } catch (error) {
    throw new Error(`KeyShot Live Companion is not connected: ${errorMessage(error)}`);
  }
  if (!isDiscovery(parsed)) throw new Error("KeyShot Live Companion discovery file is invalid.");
  if (parsed.protocolVersion !== LIVE_PROTOCOL_VERSION) {
    throw new Error(
      `KeyShot Live Companion protocol mismatch: server=${parsed.protocolVersion}, client=${LIVE_PROTOCOL_VERSION}.`,
    );
  }
  if (!isProcessAlive(parsed.pid)) throw new Error("KeyShot Live Companion session is stale because KeyShot is no longer running.");
  return parsed;
}

async function runLive(config: ServerConfig, request: KeyShotRequest): Promise<KeyShotResult> {
  try {
    const discovery = await readLiveDiscovery(config.liveDiscoveryPath);
    const response = await sendLiveRequest(discovery, request, config.keyshotTimeoutMs);
    const result: KeyShotResult = {
      ok: response.ok,
      data: response.data ?? null,
      outputFiles: response.outputFiles ?? [],
      warnings: response.warnings ?? [],
      keyshotStdoutTail: "",
      error: response.error ?? null,
      imagePath: response.imagePath,
      imageMimeType: response.imageMimeType,
      deleteImageAfterRead: response.deleteImageAfterRead,
    };
    return withErrorGuidance(result);
  } catch (error) {
    return localFailure(errorMessage(error));
  }
}

export function sendLiveRequest(
  discovery: LiveDiscovery,
  request: KeyShotRequest,
  timeoutMs: number,
): Promise<LiveWireResponse> {
  const id = randomUUID();
  const wire = JSON.stringify({
    protocolVersion: LIVE_PROTOCOL_VERSION,
    id,
    token: discovery.token,
    operation: request.operation,
    params: Object.fromEntries(Object.entries(request).filter(([key]) => key !== "operation")),
  }) + "\n";

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: discovery.port });
    let settled = false;
    let buffer = Buffer.alloc(0);
    const finish = (error?: Error, response?: LiveWireResponse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(response!);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => socket.write(wire));
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_LIVE_RESPONSE_BYTES) {
        finish(new Error("KeyShot Live Bridge response exceeded the 2 MB safety limit."));
        return;
      }
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.subarray(0, newline).toString("utf8")) as LiveWireResponse;
        if (response.id !== id || typeof response.ok !== "boolean") {
          finish(new Error("KeyShot Live Bridge returned an invalid response."));
          return;
        }
        finish(undefined, response);
      } catch (error) {
        finish(new Error(`Could not parse KeyShot Live Bridge response: ${errorMessage(error)}`));
      }
    });
    socket.once("timeout", () => finish(new Error(`KeyShot Live Bridge timed out after ${timeoutMs}ms.`)));
    socket.once("error", (error) => finish(new Error(`Could not connect to KeyShot Live Bridge: ${error.message}`)));
    socket.once("end", () => {
      if (!settled) finish(new Error("KeyShot Live Bridge closed the connection without a response."));
    });
  });
}

export async function removeStaleDiscovery(discoveryPath: string): Promise<boolean> {
  try {
    const raw = JSON.parse(await fs.readFile(discoveryPath, "utf8")) as Partial<LiveDiscovery>;
    if (typeof raw.pid === "number" && isProcessAlive(raw.pid)) return false;
    await fs.rm(discoveryPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function isDiscovery(value: unknown): value is LiveDiscovery {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.protocolVersion) && Number.isInteger(item.pid) && Number.isInteger(item.port) &&
    typeof item.token === "string" && item.token.length >= 20 && typeof item.startedAt === "string" &&
    (item.port as number) > 0 && (item.port as number) <= 65535;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function liveSnapshotMimeType(imagePath: string): string {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
