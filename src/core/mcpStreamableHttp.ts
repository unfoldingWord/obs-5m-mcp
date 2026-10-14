/**
 * Streamable HTTP GET/DELETE contract aligned with Translation Helps.
 *
 * `agents` 0.0.97 `McpAgent.serve()` only implements POST and returns 405
 * for GET/DELETE. TH production implements GET (SSE listen) and DELETE
 * (session end). This gate answers with TH's error responses (406/400) so
 * clients and browsers see the same status/body as TH, and answers DELETE
 * with a session with 200 as TH does. It does not tear down the agent's
 * session.
 *
 * A GET that would open the standalone SSE stream gets 405 instead (#6):
 * this server never sends anything unprompted, and a stream that is never
 * written is canceled by the Workers runtime as hung, after which SDK
 * clients re-open it about once a second. The spec allows 405 for a server
 * without that stream, and SDK clients treat it as "no stream".
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
  extraHeaders: Record<string, string> = {},
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
      ...extraHeaders,
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
    return jsonRpc(
      405,
      "Method Not Allowed: this server does not offer a standalone SSE stream",
      "th-jsonrpc-first",
      true,
      { Allow: "POST, DELETE, OPTIONS" },
    );
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
