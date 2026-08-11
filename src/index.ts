#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createKeyShotServer } from "./server.js";

const server = createKeyShotServer();
await server.connect(new StdioServerTransport());
