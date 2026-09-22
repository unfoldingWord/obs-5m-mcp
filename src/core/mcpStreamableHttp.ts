/**
 * Streamable HTTP GET/DELETE contract aligned with Translation Helps.
 *
 * `agents` 0.0.97 `McpAgent.serve()` only implements POST and returns 405
 * for GET/DELETE. TH production implements GET (SSE listen) and DELETE
 * (session end). This gate matches those error (and listen/end) responses
 * so clients and browsers see the same status/body as TH.
 */

/** Worker OPTIONS / auth / rate-limit CORS (matches TH worker wrapper). */
export const MCP_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Api-Key, Mcp-Session-Id",
};

/**
 * CORS attached to POST/DELETE by TH's agents transport.
 * Passed through as `corsOptions` on `McpAgent.serve()`.
 */
export const MCP_AGENT_CORS_OPTIONS = {
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  headers:
    "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
  exposeHeaders: "mcp-session-id",
};

const AGENT_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": MCP_AGENT_CORS_OPTIONS.methods,
  "Access-Control-Allow-Headers": MCP_AGENT_CORS_OPTIONS.headers,
  "Access-Control-Expose-Headers": MCP_AGENT_CORS_OPTIONS.exposeHeaders,
  "Access-Control-Max-Age": "86400",
};

const PLAIN = "text/plain;charset=UTF-8";

function jsonRpc(
  status: number,
  message: string,
  fieldOrder: "th-get-session" | "th-jsonrpc-first",
  cors: boolean,
): Response {
  const error = { code: -32000, message };
  const body =
    fieldOrder === "th-get-session"
      ? JSON.stringify({ error, id: null, jsonrpc: "2.0" })
      : JSON.stringify({ jsonrpc: "2.0", error, id: null });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": PLAIN,
      ...(cors ? AGENT_CORS_HEADERS : {}),
    },
  });
}

/**
 * Handle GET/DELETE the way TH does. Returns `null` for POST and other
 * methods so the request can continue to `McpAgent.serve()`.
 */
export function gateStreamableHttpMethods(request: Request): Response | null {
  const method = request.method;
  const sessionId = request.headers.get("mcp-session-id");

  if (method === "GET") {
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/event-stream")) {
      return jsonRpc(
        406,
        "Not Acceptable: Client must accept text/event-stream",
        "th-jsonrpc-first",
        false,
      );
    }
    if (!sessionId) {
      return jsonRpc(
        400,
        "Bad Request: Mcp-Session-Id header is required",
        "th-get-session",
        false,
      );
    }
    const { readable } = new TransformStream();
    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "mcp-session-id": sessionId,
        ...AGENT_CORS_HEADERS,
      },
    });
  }

  if (method === "DELETE") {
    if (!sessionId) {
      return jsonRpc(
        400,
        "Bad Request: Mcp-Session-Id header is required",
        "th-jsonrpc-first",
        true,
      );
    }
    return new Response(null, {
      status: 200,
      headers: AGENT_CORS_HEADERS,
    });
  }

  return null;
}
