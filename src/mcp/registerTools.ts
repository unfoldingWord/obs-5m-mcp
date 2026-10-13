/**
 * Registers every MCP tool on a server.
 *
 * Lives outside agent.ts so contract tests can exercise the production
 * registration (schemas, annotations, error mapping) without the Durable
 * Object runtime that McpAgent needs.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../core/logger.js";
import { isObs5mError, ErrorCode } from "../core/errors.js";
import type { Env } from "./agent.js";
import { MCP_TOOLS } from "./toolRegistry.js";

function mcpError(err: { code: string; message: string }) {
  return {
    content: [{ type: "text" as const, text: `Error ${err.code}: ${err.message}` }],
    isError: true as const,
  };
}

/** `getEnv` is read per call: the agent's env is not set at construction time. */
export function registerTools(server: McpServer, getEnv: () => Env): void {
  for (const tool of MCP_TOOLS) {
    const { name, description, inputSchema, outputSchema, annotations, handler } =
      tool;

    const schemaShape =
      inputSchema instanceof z.ZodEffects
        ? (inputSchema.innerType() as z.ZodObject<z.ZodRawShape>).shape
        : (inputSchema as z.ZodObject<z.ZodRawShape>).shape;

    server.registerTool(
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
          const result = await handler(params as never, getEnv(), requestId);
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
}
