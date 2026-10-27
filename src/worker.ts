/**
 * Cloudflare Worker entry — obs-5m-mcp
 *
 * Routes (worker-first):
 *   /mcp[/]*              → Obs5mMCP Durable Object
 *   /api/mcp-manifest     → JSON tool manifest
 *   /api/tool             → direct tool invoke (POST); debug:true adds X-ray
 *   /assets/pdf/<r2Key>   → stream PDF from R2
 *   /health               → liveness
 *   /api, /llms.txt, /chat, /debug → src/core/siteRoutes.ts
 *   everything else       → the static site in web/dist (env.ASSETS)
 */

import { Obs5mMCP, type Env } from "./mcp/agent.js";
import { TOOL_REGISTRY } from "./mcp/toolRegistry.js";
import { buildMcpManifest } from "./mcp/manifest.js";
import { logger } from "./core/logger.js";
import { VERSION, SERVER_NAME } from "./core/version.js";
import { runWithXray } from "./core/xray/context.js";
import { XraySession } from "./core/xray/traceEvents.js";
import { formatXrayReport } from "./core/xray/formatReport.js";
import { enforceOptionalMcpApiKey } from "./core/mcpAuth.js";
import { handleSiteRoute } from "./core/siteRoutes.js";
import { enforceRateLimit } from "./core/rateLimit.js";
import {
  gateStreamableHttpMethods,
  MCP_AGENT_CORS_OPTIONS,
  MCP_CORS,
} from "./core/mcpStreamableHttp.js";

const mcpHandler = Obs5mMCP.serve("/mcp", {
  binding: "MCP_AGENT",
  corsOptions: MCP_AGENT_CORS_OPTIONS,
});

export { Obs5mMCP };

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, name: SERVER_NAME, version: VERSION });
    }

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: MCP_CORS });
      }
      const authDenied = enforceOptionalMcpApiKey(
        request,
        env.MCP_API_KEY,
        MCP_CORS,
      );
      if (authDenied) return authDenied;
      const limited = enforceRateLimit(request, env.RATE_LIMIT_RPM, MCP_CORS);
      if (limited) return limited;
      const gated = gateStreamableHttpMethods(request);
      if (gated) return gated;
      return mcpHandler.fetch(request, env, ctx);
    }

    if (url.pathname === "/api/mcp-manifest" && request.method === "GET") {
      return Response.json(buildMcpManifest({ mcpEndpoint: "/mcp" }), {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if (
      (url.pathname === "/api/tool" && request.method === "POST") ||
      (url.pathname === "/api/tool" && request.method === "OPTIONS")
    ) {
      return handleToolCall(request, env);
    }

    if (url.pathname.startsWith("/assets/pdf/")) {
      return servePdf(url.pathname.slice("/assets/pdf/".length), env);
    }

    const site = handleSiteRoute(request, url.origin);
    if (site) return site;

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response(
      "The site is not built. Run `npm run build:web` and restart wrangler.",
      { status: 503 },
    );
  },
};

async function servePdf(encodedKey: string, env: Env): Promise<Response> {
  const key = decodeURIComponent(encodedKey);
  if (!key || key.includes("..")) {
    return new Response("Invalid key", { status: 400 });
  }
  if (!env.ASSETS_BUCKET) {
    return new Response(
      "PDF storage (R2) is not configured on this deployment.",
      { status: 503 },
    );
  }
  const obj = await env.ASSETS_BUCKET.get(key);
  if (!obj) {
    return new Response("PDF not found", { status: 404 });
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Access-Control-Allow-Origin", "*");
  if (obj.httpMetadata?.contentDisposition) {
    headers.set("Content-Disposition", obj.httpMetadata.contentDisposition);
  } else {
    headers.set(
      "Content-Disposition",
      `inline; filename="${key.split("/").pop() ?? "story.pdf"}"`,
    );
  }
  return new Response(obj.body, { status: 200, headers });
}

async function handleToolCall(request: Request, env: Env): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = (await request.json()) as {
      tool?: string;
      name?: string;
      arguments?: Record<string, unknown>;
      params?: Record<string, unknown>;
      debug?: boolean;
    };
    const name = body.tool ?? body.name;
    const args = body.arguments ?? body.params ?? {};
    const debug = Boolean(body.debug);
    if (!name || !TOOL_REGISTRY[name]) {
      return Response.json(
        { error: `Unknown tool: ${name}` },
        { status: 400, headers: cors },
      );
    }
    const tool = TOOL_REGISTRY[name];
    const parsed = tool.inputSchema.parse(args);
    const requestId = crypto.randomUUID();
    const session = debug ? new XraySession() : null;

    const run = async () => {
      const t0 = Date.now();
      try {
        const result = await tool.handler(
          parsed as never,
          env,
          requestId,
        );
        if (session) {
          const meta = (result.structuredContent as { _meta?: Record<string, unknown> })
            ?._meta;
          session.push({
            type: "tool_call",
            name,
            params: parsed as Record<string, unknown>,
            summary:
              result.content?.find((c) => c.type === "text")?.text?.slice(0, 200) ??
              undefined,
            resultSnapshot: summarizeResult(result.structuredContent),
            ms: Date.now() - t0,
            ok: result.isError !== true,
            cacheStatus: result.cacheStatus,
            downstreamApiCalls:
              typeof meta?.downstream_api_calls === "number"
                ? meta.downstream_api_calls
                : undefined,
          });
        }
        return result;
      } catch (err) {
        if (session) {
          session.push({
            type: "tool_call",
            name,
            params: parsed as Record<string, unknown>,
            ms: Date.now() - t0,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        throw err;
      }
    };

    const result = session
      ? await runWithXray(session, run)
      : await run();

    if (!session) {
      return Response.json(result, { status: 200, headers: cors });
    }

    const events = session.done();
    const xrayReport = formatXrayReport(events, {
      tool: name,
      url: env.PUBLIC_BASE_URL,
    });

    return Response.json(
      {
        result,
        xray: events,
        xrayReport,
      },
      { status: 200, headers: cors },
    );
  } catch (err) {
    logger.error("api/tool failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: cors },
    );
  }
}

function summarizeResult(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...obj };
  if (typeof copy.communityStudy === "string" && copy.communityStudy.length > 400) {
    copy.communityStudy = copy.communityStudy.slice(0, 400) + "…";
  }
  if (Array.isArray(copy.movements)) {
    copy.movements = copy.movements.map((m) => {
      if (!m || typeof m !== "object") return m;
      const mm = { ...(m as Record<string, unknown>) };
      if (typeof mm.markdown === "string" && mm.markdown.length > 300) {
        mm.markdown = mm.markdown.slice(0, 300) + "…";
      }
      return mm;
    });
  }
  if (typeof copy.content === "string" && copy.content.length > 800) {
    copy.content = copy.content.slice(0, 800) + "…";
  }
  return copy;
}
