import { describe, expect, it } from "vitest";
import { gateStreamableHttpMethods } from "../../src/core/mcpStreamableHttp.js";

function mcp(method: string, headers: Record<string, string> = {}): Request {
  return new Request("https://obs-5m-mcp.unfoldingword.workers.dev/mcp", {
    method,
    headers,
  });
}

describe("gateStreamableHttpMethods (TH Streamable HTTP contract)", () => {
  it("GET without text/event-stream is 406 like TH", async () => {
    const res = gateStreamableHttpMethods(
      mcp("GET", { Accept: "application/json" }),
    );
    expect(res?.status).toBe(406);
    expect(await res!.text()).toBe(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Not Acceptable: Client must accept text/event-stream",
        },
        id: null,
      }),
    );
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("GET with both Accept types and no session is 400 like TH", async () => {
    const res = gateStreamableHttpMethods(
      mcp("GET", { Accept: "application/json, text/event-stream" }),
    );
    expect(res?.status).toBe(400);
    expect(await res!.text()).toBe(
      JSON.stringify({
        error: {
          code: -32000,
          message: "Bad Request: Mcp-Session-Id header is required",
        },
        id: null,
        jsonrpc: "2.0",
      }),
    );
  });

  it("GET with session answers 405: no standalone SSE stream (#6)", async () => {
    // The server sends nothing unprompted. A stream that is never written is
    // canceled by the Workers runtime as hung, and SDK clients then re-open
    // it about once a second. The spec allows 405 here, and SDK clients
    // treat it as "no stream" without retrying.
    const res = gateStreamableHttpMethods(
      mcp("GET", {
        Accept: "text/event-stream",
        "mcp-session-id": "abc",
      }),
    );
    expect(res?.status).toBe(405);
    expect(res!.headers.get("Allow")).toBe("POST, DELETE, OPTIONS");
    expect(res!.headers.get("Content-Type")).not.toBe("text/event-stream");
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res!.json()).toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method Not Allowed: this server does not offer a standalone SSE stream",
      },
      id: null,
    });
  });

  it("DELETE without session is 400 like TH", async () => {
    const res = gateStreamableHttpMethods(mcp("DELETE"));
    expect(res?.status).toBe(400);
    expect(await res!.text()).toBe(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: Mcp-Session-Id header is required",
        },
        id: null,
      }),
    );
    expect(res!.headers.get("Access-Control-Allow-Methods")).toContain(
      "DELETE",
    );
  });

  it("DELETE with session answers 200 like TH (agent session is not torn down)", () => {
    const res = gateStreamableHttpMethods(
      mcp("DELETE", { "mcp-session-id": "abc" }),
    );
    expect(res?.status).toBe(200);
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("does not intercept POST", () => {
    expect(gateStreamableHttpMethods(mcp("POST"))).toBeNull();
  });
});
