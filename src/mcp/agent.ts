/**
 * Obs5mMCP — McpAgent Durable Object for OBS Five Movements.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION, SERVER_NAME } from "../core/version.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { PROMPTS } from "./prompts/index.js";
import { registerTools } from "./registerTools.js";

export interface Env {
  MCP_AGENT: DurableObjectNamespace;
  OBS_5M_CACHE: KVNamespace;
  /** Optional — Indonesian PDF hosting (enable R2 + uncomment wrangler binding). */
  ASSETS_BUCKET?: R2Bucket;
  /** Workers Assets — SvelteKit chat UI (adapter-cloudflare). */
  ASSETS?: Fetcher;
  PUBLIC_BASE_URL?: string;
  /** Optional Bearer/X-Api-Key for /mcp. Unset = anonymous public access. */
  MCP_API_KEY?: string;
  /** Max requests/min per IP for /mcp. Default 90; 0 = off. */
  RATE_LIMIT_RPM?: string;
}

export class Obs5mMCP extends McpAgent<Env> {
  server = new McpServer(
    { name: SERVER_NAME, version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  async init(): Promise<void> {
    registerTools(this.server, () => this.env);

    for (const prompt of PROMPTS) {
      this.server.prompt(
        prompt.name,
        prompt.description,
        prompt.argsSchema,
        prompt.handler as never,
      );
    }
  }
}
