#!/usr/bin/env node
// stdio entry point: npx -y bouncelens-email-check
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

await createServer().connect(new StdioServerTransport());
