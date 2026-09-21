/**
 * Obs5mMCP — McpAgent Durable Object for OBS Five Movements.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VERSION, SERVER_NAME } from "../core/version.js";
import { logger } from "../core/logger.js";
import { isObs5mError, ErrorCode } from "../core/errors.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { MCP_TOOLS } from "./toolRegistry.js";
import { PROMPTS } from "./prompts/index.js";

export interface Env {
  MCP_AGENT: DurableObjectNamespace;
  OBS_5M_CACHE: KVNamespace;
  /** Optional — Indonesian PDF hosting (enable R2 + uncomment wrangler binding). */
  ASSETS_BUCKET?: R2Bucket;
  /** Workers Assets — SvelteKit chat UI (adapter-cloudflare). */
  ASSETS?: Fetcher;
  PUBLIC_BASE_URL?: string;
  /** Required for /chat and POST /api/chat (OpenAI tool-calling loop). */
  OPENAI_API_KEY?: string;
  /** Optional Bearer/X-Api-Key for /mcp. Unset = anonymous public access. */
  MCP_API_KEY?: string;
  /** Max requests/min per IP for /mcp. Default 90; 0 = off. */
  RATE_LIMIT_RPM?: string;
}

function mcpError(err: { code: string; message: string }) {
  return {
    content: [{ type: "text" as const, text: `Error ${err.code}: ${err.message}` }],
    isError: true as const,
  };
}

export class Obs5mMCP extends McpAgent<Env> {
  server = new McpServer(
    { name: SERVER_NAME, version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  async init(): Promise<void> {
    for (const tool of MCP_TOOLS) {
      const { name, description, inputSchema, outputSchema, annotations, handler } =
        tool;

      const schemaShape =
        inputSchema instanceof z.ZodEffects
          ? (inputSchema.innerType() as z.ZodObject<z.ZodRawShape>).shape
          : (inputSchema as z.ZodObject<z.ZodRawShape>).shape;

      this.server.registerTool(
        name,
        {
          title: annotations.title,
          description,
          inputSchema: schemaShape as Record<string, z.ZodTypeAny>,
          ...(outputSchema ? { outputSchema } : {}),
          annotations: {
            readOnlyHint: annotations.readOnlyHint,
            ...(annotations.destructiveHint !== undefined
              ? { destructiveHint: annotations.destructiveHint }
              : {}),
          },
        },
        async (params: Record<string, unknown>) => {
          const requestId = crypto.randomUUID();
          try {
            logger.info("tool:call", { tool: name, requestId });
            const result = await handler(params as never, this.env, requestId);
            return result as never;
          } catch (err) {
            if (isObs5mError(err)) {
              logger.error("tool:error", {
                tool: name,
                requestId,
                code: err.code,
                message: err.message,
              });
              return mcpError(err.toMcpError()) as never;
            }
            const message = err instanceof Error ? err.message : String(err);
            logger.error("tool:unexpected_error", {
              tool: name,
              requestId,
              message,
            });
            return mcpError({
              code: ErrorCode.INTERNAL_ERROR,
              message: `Internal error in ${name}: ${message}`,
            }) as never;
          }
        },
      );
    }

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
