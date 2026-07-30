import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LIVE_PROTOCOL_VERSION,
  readLiveDiscovery,
  removeStaleDiscovery,
  sendLiveRequest,
  type LiveDiscovery,
} from "../src/live-client.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((item) => fs.rm(item, { recursive: true, force: true })));
});

describe("KeyShot Live client", () => {
  it("reads a valid local discovery file without exposing assumptions about a fixed port", async () => {
    const root = await tempDir();
    const discoveryPath = path.join(root, "session.json");
    const discovery = makeDiscovery();
    await fs.writeFile(discoveryPath, JSON.stringify(discovery));
    await expect(readLiveDiscovery(discoveryPath)).resolves.toEqual(discovery);
  });

  it("rejects protocol mismatches and stale sessions", async () => {
    const root = await tempDir();
    const mismatch = path.join(root, "mismatch.json");
    await fs.writeFile(mismatch, JSON.stringify({ ...makeDiscovery(), protocolVersion: 99 }));
    await expect(readLiveDiscovery(mismatch)).rejects.toThrow(/protocol mismatch/i);

    const stale = path.join(root, "stale.json");
    await fs.writeFile(stale, JSON.stringify({ ...makeDiscovery(), pid: 2_000_000_000 }));
    await expect(readLiveDiscovery(stale)).rejects.toThrow(/stale/i);
    await expect(removeStaleDiscovery(stale)).resolves.toBe(true);
  });

  it("authenticates and parses one newline-delimited response", async () => {
    const server = net.createServer((socket) => {
      let input = "";
      socket.on("data", (chunk) => {
        input += chunk.toString("utf8");
        if (!input.includes("\n")) return;
        const request = JSON.parse(input.trim());
        expect(request.token).toBe("x".repeat(32));
        expect(request.operation).toBe("live_status");
        socket.end(JSON.stringify({ id: request.id, ok: true, data: { connected: true } }) + "\n");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    try {
      await expect(sendLiveRequest({ ...makeDiscovery(), port: address.port }, { operation: "live_status" }, 1000))
        .resolves.toMatchObject({ ok: true, data: { connected: true } });
    } finally {
      server.close();
    }
  });

  it("rejects a response with the wrong request id", async () => {
    const server = net.createServer((socket) => socket.end(JSON.stringify({ id: "wrong", ok: true }) + "\n"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    try {
      await expect(sendLiveRequest({ ...makeDiscovery(), port: address.port }, { operation: "live_status" }, 1000))
        .rejects.toThrow(/invalid response/i);
    } finally {
      server.close();
    }
  });
});

function makeDiscovery(): LiveDiscovery {
  return {
    protocolVersion: LIVE_PROTOCOL_VERSION,
    pid: process.pid,
    port: 12345,
    token: "x".repeat(32),
    startedAt: "2026-07-22T00:00:00Z",
    keyshotVersion: "14.1",
  };
}

async function tempDir(): Promise<string> {
  const result = await fs.mkdtemp(path.join(os.tmpdir(), "keyshot-live-client-"));
  temporary.push(result);
  return result;
}
