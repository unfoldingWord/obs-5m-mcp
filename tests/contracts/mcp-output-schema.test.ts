/**
 * MCP outputSchema conformance (SDK 1.15+ validates structuredContent).
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  notAvailable,
  withNotAvailableOutput,
} from "../../src/mcp/tools/shared.js";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import { listLanguagesTool } from "../../src/mcp/tools/listLanguages.js";
import { listResourcesTool } from "../../src/mcp/tools/listResources.js";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
} from "../helpers/mockDcsFetch.js";

describe("withNotAvailableOutput", () => {
  it("accepts success payloads", () => {
    const schema = z.object(
      withNotAvailableOutput({
        languages: z.array(z.object({ code: z.string() })).optional(),
      }),
    );
    expect(
      schema.safeParse({ languages: [{ code: "en" }] }).success,
    ).toBe(true);
  });

  it("accepts RESOURCE_NOT_AVAILABLE envelope", () => {
    const schema = z.object(
      withNotAvailableOutput({ story: z.number().optional() }),
    );
    const result = notAvailable("OBS study manual");
    const parsed = schema.safeParse(result.structuredContent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.available).toBe(false);
      expect(parsed.data.code).toBe("RESOURCE_NOT_AVAILABLE");
    }
  });
});

describe("every tool outputSchema accepts notAvailable()", () => {
  for (const tool of MCP_TOOLS) {
    if (!tool.outputSchema) continue;
    it(`${tool.name} outputSchema accepts notAvailable`, () => {
      const schema = z.object(tool.outputSchema!);
      const result = notAvailable(tool.name);
      expect(result.isError).toBe(false);
      expect(schema.safeParse(result.structuredContent).success).toBe(true);
    });
  }
});

describe("fetch_obs_study_manual outputSchema", () => {
  const schema = z.object(fetchObsStudyManualTool.outputSchema!);

  it("accepts a success-shaped payload", () => {
    const parsed = schema.safeParse({
      resourceType: "obs-tf",
      reference: "1:1",
      language: "en",
      story: 1,
      frame: 1,
      storyTitle: "The Creation",
      movements: [],
      sections: {},
      source: {},
      _meta: { downstream_api_calls: 1, cache_status: "miss" },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("list_resources outputSchema", () => {
  const schema = z.object(listResourcesTool.outputSchema!);
  const row = {
    id: "obs-tf",
    type: "structured",
    abbreviation: "OBS-TF",
    subject: "OBS Theological Formation",
    available: true,
    source: "door43",
  };

  it("accepts `available` as an array of rows on success", () => {
    expect(
      schema.safeParse({ language: "en", available: [row], resources: [row] })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ language: "xx", available: [], resources: [] })
        .success,
    ).toBe(true);
  });

  it("rejects `available` values that are neither rows nor a boolean", () => {
    expect(schema.safeParse({ available: "yes" }).success).toBe(false);
  });
});

describe("list_languages outputSchema", () => {
  const schema = z.object(listLanguagesTool.outputSchema!);

  it("accepts success-shaped structuredContent", () => {
    expect(
      schema.safeParse({
        languages: [{ code: "en", name: "English", sources: ["dcs-obs-tf"] }],
        cacheStatus: "hit",
        downstreamApiCalls: 0,
      }).success,
    ).toBe(true);
  });
});

/**
 * Round trip through the SDK: the server validates structuredContent against
 * the declared outputSchema, and the client validates it again against the
 * JSON Schema it got from tools/list. `available` is an array on success and
 * `false` on soft-NA, so both ends must accept the union.
 */
describe("list_resources over the MCP SDK", () => {
  let client: Client;

  beforeEach(async () => {
    stubDcsFetch();
    const server = new McpServer({ name: "obs-5m-test", version: "0.0.0" });
    // Same registration shape as Obs5mMCP.init().
    server.registerTool(
      listResourcesTool.name,
      {
        description: listResourcesTool.description,
        inputSchema: (
          listResourcesTool.inputSchema as z.ZodObject<z.ZodRawShape>
        ).shape,
        outputSchema: listResourcesTool.outputSchema!,
      },
      async (params: Record<string, unknown>) =>
        (await listResourcesTool.handler(
          params as never,
          emptyEnv(),
          "t",
        )) as never,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "obs-5m-test-client", version: "0.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    // Populates the client's per-tool output validators.
    await client.listTools();
  });

  afterEach(async () => {
    await client.close();
    restoreFetch();
  });

  it("returns `available` rows for a language with OBS-TF", async () => {
    const result = await client.callTool({
      name: "list_resources",
      arguments: { language: "en" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as { available: unknown[] };
    expect(sc.available).toHaveLength(1);
  });

  it("returns an empty `available` for a language without OBS-TF", async () => {
    const result = await client.callTool({
      name: "list_resources",
      arguments: { language: "xx" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as { available: unknown[] };
    expect(sc.available).toEqual([]);
  });
});
