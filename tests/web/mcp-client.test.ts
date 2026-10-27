import { describe, expect, it } from "vitest";
import { McpHttpClient, parseRpcBody } from "../../web/src/lib/mcp/client.js";
import { classifyOutcome } from "../../web/src/lib/mcp/outcome.js";

type Sent = { headers: Headers; body: Record<string, unknown> };

function fakeServer(reply: (body: Record<string, unknown>) => { status?: number; type?: string; text: string; headers?: Record<string, string> }) {
  const sent: Sent[] = [];
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push({ headers: new Headers(init?.headers), body });
    const r = reply(body);
    return new Response(r.text, {
      status: r.status ?? 200,
      headers: { "Content-Type": r.type ?? "application/json", ...(r.headers ?? {}) },
    });
  };
  return { sent, fetchImpl: fetchImpl as typeof fetch };
}

const rpc = (id: unknown, result: unknown) => JSON.stringify({ jsonrpc: "2.0", id, result });

describe("parseRpcBody", () => {
  it("reads JSON and SSE bodies to the same message", () => {
    const msg = { jsonrpc: "2.0", id: 1, result: { ok: true } };
    expect(parseRpcBody("application/json", JSON.stringify(msg))).toEqual(msg);
    const sse = `event: message\ndata: ${JSON.stringify(msg)}\n\n`;
    expect(parseRpcBody("text/event-stream", sse)).toEqual(msg);
  });
});

describe("McpHttpClient", () => {
  it("keeps the session id from initialize and sends it afterwards", async () => {
    const { sent, fetchImpl } = fakeServer((b) => {
      if (b.method === "initialize") {
        return { text: rpc(b.id, { protocolVersion: "2025-03-26", capabilities: {} }), headers: { "Mcp-Session-Id": "abc" } };
      }
      if (b.method === "notifications/initialized") return { status: 202, text: "" };
      return { text: rpc(b.id, { tools: [{ name: "list_stories", description: "d", inputSchema: { type: "object" } }] }) };
    });
    const client = new McpHttpClient("https://x/mcp", fetchImpl);
    await client.initialize();
    const tools = await client.listTools();
    expect(tools[0].name).toBe("list_stories");
    const last = sent.at(-1)!;
    expect(last.headers.get("Mcp-Session-Id")).toBe("abc");
    expect(last.headers.get("Accept")).toBe("application/json, text/event-stream");
    expect(sent.map((s) => s.body.method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
  });

  it("logs one exchange per tool call with its size", async () => {
    let bodyText = "";
    const { fetchImpl } = fakeServer((b) => {
      if (b.method === "tools/call") {
        bodyText = rpc(b.id, {
          content: [{ type: "text", text: "# Story" }],
          structuredContent: { reference: "1" },
          isError: false,
        });
        return { text: bodyText };
      }
      return { text: rpc(b.id, {}) };
    });
    const client = new McpHttpClient("https://x/mcp", fetchImpl);
    const before = client.log.length;
    const result = await client.callTool("fetch_obs_study_manual", { reference: "1" });
    expect(client.log.length).toBe(before + 1);
    expect(result.text).toBe("# Story");
    expect(result.structured).toEqual({ reference: "1" });
    expect(result.isError).toBe(false);
    expect(result.exchange.bytes).toBe(new TextEncoder().encode(bodyText).length);
    expect(result.exchange.status).toBe(200);
  });
});

describe("McpHttpClient with a stream that stays open", () => {
  it("returns as soon as the answer to its request arrives", async () => {
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { id?: number; method: string };
      if (body.id === undefined) return new Response(null, { status: 202 });
      const event = `event: message\ndata: ${rpc(body.id, { tools: [] })}\n\n`;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(event));
          // never closes, like the server's SSE response
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const client = new McpHttpClient("https://x/mcp", fetchImpl);
    const done = Promise.race([
      client.initialize().then(() => client.listTools()),
      new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), 1000)),
    ]);
    await expect(done).resolves.toEqual([]);
  });
});

describe("McpHttpClient request order and time limit", () => {
  it("never has two requests in flight on one session", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { id?: number };
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response(rpc(body.id, { content: [{ type: "text", text: "ok" }] }), {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const client = new McpHttpClient("https://x/mcp", fetchImpl);
    await Promise.all([client.callTool("a", {}), client.callTool("b", {}), client.callTool("c", {})]);
    expect(maxInFlight).toBe(1);
  });

  it("gives up on a request that gets no answer", async () => {
    const fetchImpl = (async () => {
      const stream = new ReadableStream<Uint8Array>({ start() {} });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const client = new McpHttpClient("https://x/mcp", fetchImpl, { timeoutMs: 50 });
    await expect(client.callTool("a", {})).rejects.toThrow(/did not answer/);
  });
});

describe("classifyOutcome", () => {
  const exchange = { request: {}, response: {}, status: 200, bytes: 1, ms: 1 };
  it("sorts results into the five kinds", () => {
    expect(classifyOutcome({ status: 200, result: { text: "x", structured: {}, isError: false, exchange } })).toEqual({ kind: "ok" });
    expect(
      classifyOutcome({
        status: 200,
        result: { text: "", structured: { available: false, message: "No Indonesian content for story 3 yet." }, isError: false, exchange },
      }),
    ).toEqual({ kind: "not-available", message: "No Indonesian content for story 3 yet." });
    expect(
      classifyOutcome({ status: 200, result: { text: "Error UPSTREAM_DCS_ERROR: Door43 timed out", structured: null, isError: true, exchange } }).kind,
    ).toBe("upstream");
    expect(classifyOutcome({ status: 429, retryAfter: "30" })).toEqual({ kind: "rate-limited", retryAfterSeconds: 30 });
    expect(classifyOutcome({ status: 429, retryAfter: null })).toEqual({ kind: "rate-limited", retryAfterSeconds: 60 });
    expect(classifyOutcome({ status: 200, error: new Error("boom") })).toEqual({ kind: "error", message: "boom" });
  });
});
