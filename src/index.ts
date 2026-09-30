#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createKeyShotServer } from "./server.js";

await serveStdio(() => createKeyShotServer());
