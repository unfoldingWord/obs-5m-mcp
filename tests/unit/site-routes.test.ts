import { describe, expect, it } from "vitest";
import { handleSiteRoute } from "../../src/core/siteRoutes.js";
import { buildLlmsTxt } from "../../src/core/llmsTxt.js";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";

const BASE = "https://obs.example";
const get = (path: string, accept = "text/html") =>
  handleSiteRoute(new Request(BASE + path, { headers: { Accept: accept } }), BASE);

describe("site routes", () => {
  it("redirects the old chat and debug pages to /try", () => {
    const chat = get("/chat")!;
    expect(chat.status).toBe(301);
    expect(chat.headers.get("Location")).toBe(`${BASE}/try`);
    const debug = get("/debug")!;
    expect(debug.status).toBe(301);
    expect(debug.headers.get("Location")).toBe(`${BASE}/try?tab=tools`);
  });

  it("serves llms.txt with the endpoint and every tool", async () => {
    const res = get("/llms.txt")!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/plain/);
    const text = await res.text();
    expect(text.startsWith("# OBS-TF MCP")).toBe(true);
    expect(text).toContain(`${BASE}/mcp`);
    for (const t of MCP_TOOLS) expect(text).toContain(t.name);
  });

  it("leaves HTML pages to the static assets", () => {
    expect(get("/")).toBeNull();
    expect(get("/try")).toBeNull();
    expect(get("/docs")).toBeNull();
  });

  it("answers JSON discovery at / and /api without chat links", async () => {
    for (const path of ["/", "/api"]) {
      const res = get(path, "application/json")!;
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.mcp).toBe("/mcp");
      expect(body.llms).toBe("/llms.txt");
      expect(JSON.stringify(body)).not.toMatch(/chat|debug/);
    }
  });

  it("no longer handles /api/chat", () => {
    const res = handleSiteRoute(new Request(BASE + "/api/chat", { method: "POST" }), BASE);
    expect(res).toBeNull();
  });
});

describe("buildLlmsTxt", () => {
  it("lists tools in registry order with links", () => {
    const text = buildLlmsTxt(BASE);
    const positions = MCP_TOOLS.map((t) => text.indexOf(`- ${t.name}:`));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const link of ["/try", "/connect", "/tools", "/docs", "formationstories.org", "door43.org"]) {
      expect(text).toContain(link);
    }
  });
});
