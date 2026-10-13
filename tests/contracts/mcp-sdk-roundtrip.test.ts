/**
 * Every tool's real output must validate against the schema it advertises.
 *
 * The MCP SDK publishes each outputSchema as a closed JSON Schema
 * (additionalProperties: false). The server-side check uses zod, which
 * silently strips unknown keys, so a tool that returns a field its schema
 * does not declare passes on the server and is then rejected by any client
 * that validates structuredContent (the SDK client does, after listTools()).
 *
 * These tests run the production registration against such a client. A new
 * tool, or a new field on an existing payload, has to be declared to pass.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STUDY_MANUAL_PARTS } from "../../src/content/studyManual.js";
import type { Env } from "../../src/mcp/agent.js";
import { registerTools } from "../../src/mcp/registerTools.js";
import { MCP_TOOLS, TOOL_REGISTRY } from "../../src/mcp/toolRegistry.js";
import { listResourcesTool } from "../../src/mcp/tools/listResources.js";
import { notAvailable } from "../../src/mcp/tools/shared.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
  stubIndonesianDcsFetch,
} from "../helpers/mockDcsFetch.js";

interface RoundTripCase {
  tool: string;
  label: string;
  args: Record<string, unknown>;
  /** Catalog stub to use instead of the English-only default. */
  catalog?: "indonesian-dcs";
  /** Expect the soft RESOURCE_NOT_AVAILABLE envelope instead of content. */
  notAvailable?: boolean;
}

const CASES: RoundTripCase[] = [
  { tool: "list_languages", label: "catalog languages", args: {} },
  { tool: "list_resources", label: "language with OBS-TF", args: { language: "en" } },
  { tool: "list_resources", label: "language without OBS-TF", args: { language: "xx" } },
  { tool: "list_collections", label: "all collections", args: {} },
  { tool: "list_stories", label: "all stories", args: { language: "en" } },
  { tool: "list_stories", label: "one collection", args: { language: "en", collection: 1 } },
  { tool: "get_framework", label: "framework", args: {} },

  { tool: "fetch_obs_study_manual", label: "json story:frame", args: { reference: "1:1", language: "en" } },
  { tool: "fetch_obs_study_manual", label: "json intro frame", args: { reference: "1:0", language: "en" } },
  { tool: "fetch_obs_study_manual", label: "json movement filter", args: { reference: "1", language: "en", movement: 4 } },
  ...STUDY_MANUAL_PARTS.map((part) => ({
    tool: "fetch_obs_study_manual",
    label: `json part=${part}`,
    args: { reference: "1", language: "en", part },
  })),
  { tool: "fetch_obs_study_manual", label: "md", args: { reference: "1", language: "en", format: "md" } },
  { tool: "fetch_obs_study_manual", label: "text", args: { reference: "1:1", language: "en", format: "text" } },
  { tool: "fetch_obs_study_manual", label: "Indonesian from DCS", args: { reference: "1", language: "id" }, catalog: "indonesian-dcs" },
  { tool: "fetch_obs_study_manual", label: "Indonesian local markdown", args: { reference: "2", language: "id" } },
  { tool: "fetch_obs_study_manual", label: "language without OBS-TF", args: { reference: "1", language: "xx" }, notAvailable: true },

  { tool: "get_story", label: "by number", args: { story: 1, language: "en" } },
  { tool: "get_story", label: "by title", args: { story: "The Creation", language: "en" } },
  { tool: "get_story", label: "language without OBS-TF", args: { story: 1, language: "xx" }, notAvailable: true },
  ...[1, 2, 3, 4, 5].map((movement) => ({
    tool: "get_movement",
    label: `movement ${movement}`,
    args: { story: 1, movement, language: "en" },
  })),
  { tool: "get_movement", label: "language without OBS-TF", args: { story: 1, movement: 1, language: "xx" }, notAvailable: true },
  { tool: "get_devotional", label: "community study", args: { story: 1, language: "en" } },
  { tool: "get_devotional", label: "language without OBS-TF", args: { story: 1, language: "xx" }, notAvailable: true },
  { tool: "get_study_guide", label: "full bundle", args: { story: 1, language: "en" } },
  { tool: "get_study_guide", label: "language without OBS-TF", args: { story: 1, language: "xx" }, notAvailable: true },
  { tool: "get_pdf", label: "Indonesian PDF", args: { story: 1, language: "id" } },
  { tool: "get_pdf", label: "language without a PDF", args: { story: 1, language: "en" }, notAvailable: true },
  { tool: "search_content", label: "with hits", args: { query: "creation", language: "en", maxStories: 2 } },
  { tool: "search_content", label: "without hits", args: { query: "zzqqxx", language: "en", maxStories: 1 } },
];

/** Top-level keys a result carries that its tool's outputSchema does not declare. */
function undeclaredKeys(toolName: string, structuredContent: unknown): string[] {
  const declared = new Set(Object.keys(TOOL_REGISTRY[toolName]?.outputSchema ?? {}));
  return Object.keys((structuredContent ?? {}) as object).filter(
    (key) => !declared.has(key),
  );
}

/** A client that validates tool output, linked in memory to `server`. */
async function connectValidatingClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "obs-5m-test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  // Populates the client's per-tool output validators.
  await client.listTools();
  return client;
}

describe("tool output over the MCP SDK", () => {
  let client: Client | undefined;

  beforeEach(async () => {
    stubDcsFetch();
    const server = new McpServer({ name: "obs-5m-test", version: "0.0.0" });
    registerTools(server, () => emptyEnv() as Env);
    client = await connectValidatingClient(server);
  });

  afterEach(async () => {
    restoreFetch();
    await client?.close();
    client = undefined;
  });

  it("has a case for every registered tool", () => {
    expect([...new Set(CASES.map((c) => c.tool))].sort()).toEqual(
      MCP_TOOLS.map((t) => t.name).sort(),
    );
  });

  for (const c of CASES) {
    it(`${c.tool}: ${c.label}`, async () => {
      if (c.catalog === "indonesian-dcs") stubIndonesianDcsFetch();

      // The SDK only reports "additional properties", so name the keys first.
      const tool = TOOL_REGISTRY[c.tool]!;
      const direct = await tool.handler(
        tool.inputSchema.parse(c.args) as never,
        emptyEnv() as Env,
        "t",
      );
      expect(undeclaredKeys(c.tool, direct.structuredContent)).toEqual([]);

      const result = await client!.callTool({ name: c.tool, arguments: c.args });
      expect(result.isError).toBeFalsy();
      const sc = result.structuredContent as { available?: unknown };
      if (c.notAvailable) {
        expect(sc.available).toBe(false);
      } else {
        expect(sc.available).not.toBe(false);
      }
    });
  }

  it("maps a handler error to an isError result", async () => {
    // registerTools wraps every handler: a thrown Obs5mError must reach the
    // client as a tool error, not as a protocol failure.
    const result = await client!.callTool({
      name: "fetch_obs_study_manual",
      arguments: { reference: "not-a-ref", language: "en" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("INVALID_PARAMS");
  });
});

describe("list_resources `available` union over the MCP SDK", () => {
  it("accepts the soft not-available envelope on a validating client", async () => {
    // The handler only returns rows today, but the schema promises both
    // shapes: rows on success, `false` on soft-NA. Serve the envelope from a
    // stand-in that advertises the real schema.
    const server = new McpServer({ name: "obs-5m-test", version: "0.0.0" });
    server.registerTool(
      listResourcesTool.name,
      { outputSchema: listResourcesTool.outputSchema! },
      async () => notAvailable("OBS-TF") as never,
    );
    const client = await connectValidatingClient(server);
    try {
      const result = await client.callTool({ name: listResourcesTool.name });
      expect(result.isError).toBeFalsy();
      expect(
        (result.structuredContent as { available?: unknown }).available,
      ).toBe(false);
    } finally {
      await client.close();
    }
  });
});
