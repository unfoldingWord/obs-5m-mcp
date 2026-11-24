import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../../src/mcp/agent.js";
import { registerTools } from "../../src/mcp/registerTools.js";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
} from "../helpers/mockDcsFetch.js";

type RelayBlock = { id: string; text: string };

function relayOf(result: {
  _meta?: Record<string, unknown>;
  structuredContent?: Record<string, unknown>;
}): RelayBlock[] | undefined {
  return result._meta?.["bt/relay"] as RelayBlock[] | undefined;
}

describe("fetch_obs_study_manual relay blocks", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
  });

  it("json, md and text return the same bt/relay blocks", async () => {
    const args = {
      reference: "1:5",
      language: "en",
      part: "full" as const,
    };
    const results = await Promise.all(
      (["json", "md", "text"] as const).map((format) =>
        fetchObsStudyManualTool.handler(
          { ...args, format },
          emptyEnv(),
          `relay-${format}`,
        ),
      ),
    );
    const relays = results.map(relayOf);
    expect(relays[0]).toBeDefined();
    expect(relays[0]!.length).toBeGreaterThan(0);
    expect(relays[1]).toEqual(relays[0]);
    expect(relays[2]).toEqual(relays[0]);
  });

  it("does not put bt/relay into structuredContent or content text", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1:5", language: "en", format: "json" },
      emptyEnv(),
      "relay-sc",
    );
    expect(relayOf(result)).toBeDefined();
    expect(result.structuredContent).not.toHaveProperty("bt/relay");
    const scMeta = result.structuredContent?._meta as
      | Record<string, unknown>
      | undefined;
    expect(scMeta).not.toHaveProperty("bt/relay");
    for (const block of result.content) {
      expect(block.text).not.toContain("bt/relay");
      expect(block.text).not.toContain("obs-en-01-05-observation");
    }
  });

  it("part=intro omits the bt/relay key", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "en", part: "intro", format: "json" },
      emptyEnv(),
      "relay-intro",
    );
    expect(result._meta).toBeUndefined();
  });

  it("not-available responses have no bt/relay", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "xx", format: "json" },
      emptyEnv(),
      "relay-na",
    );
    expect(result.structuredContent?.available).toBe(false);
    expect(result._meta).toBeUndefined();
  });

  it("include_answers:false yields the same observation blocks as true", async () => {
    const args = {
      reference: "1:5",
      language: "en",
      part: "movement1" as const,
      format: "json" as const,
    };
    const withAnswers = await fetchObsStudyManualTool.handler(
      { ...args, include_answers: true },
      emptyEnv(),
      "relay-ia-true",
    );
    const withoutAnswers = await fetchObsStudyManualTool.handler(
      { ...args, include_answers: false },
      emptyEnv(),
      "relay-ia-false",
    );
    const trueRelay = relayOf(withAnswers);
    const falseRelay = relayOf(withoutAnswers);
    expect(trueRelay).toBeDefined();
    expect(trueRelay!.some((b) => b.id.endsWith("-observation"))).toBe(true);
    expect(falseRelay).toEqual(trueRelay);
    for (const block of falseRelay!) {
      expect(block.text).not.toMatch(/^[^-]/);
      for (const line of block.text.split("\n")) {
        if (line.startsWith("- ")) {
          // Question-only lines; answers never appear as a block body.
          expect(line.endsWith("?") || line.endsWith("？") || line.endsWith("؟")).toBe(
            true,
          );
        }
      }
    }
  });

  it("include_answers:false leaves content and structuredContent unchanged", async () => {
    const args = {
      reference: "1:5",
      language: "en",
      part: "movement1" as const,
      include_answers: false as const,
      format: "json" as const,
    };
    const result = await fetchObsStudyManualTool.handler(
      args,
      emptyEnv(),
      "relay-ia-sc",
    );
    expect(result.structuredContent?.includeAnswers).toBe(false);
    const movements = result.structuredContent?.movements as Array<{
      observation?: Array<{ items: Array<{ question: string; answer?: string }> }>;
    }>;
    const items = movements?.[0]?.observation?.flatMap((b) => b.items) ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).not.toHaveProperty("answer");
    }
    expect(result.structuredContent).not.toHaveProperty("trusted");
    expect(result.structuredContent).not.toHaveProperty("trust");
    const scMeta = result.structuredContent?._meta as
      | Record<string, unknown>
      | undefined;
    expect(scMeta).not.toHaveProperty("bt/relay");
    for (const block of result.content) {
      expect(block.text).not.toContain("bt/relay");
    }
  });

  it("frame-filtered reference still yields only that frame's observation block", async () => {
    const result = await fetchObsStudyManualTool.handler(
      {
        reference: "1:5",
        language: "en",
        part: "movement1",
        include_answers: false,
        format: "json",
      },
      emptyEnv(),
      "relay-ia-frame",
    );
    const blocks = relayOf(result) ?? [];
    const obs = blocks.filter((b) => b.id.endsWith("-observation"));
    expect(obs.map((b) => b.id)).toEqual(["obs-en-01-05-observation"]);
  });
});

describe("fetch_obs_study_manual relay over registerTools", () => {
  let client: Client | undefined;

  beforeEach(async () => {
    stubDcsFetch();
    const server = new McpServer({ name: "obs-5m-relay-test", version: "0.0.0" });
    registerTools(server, () => emptyEnv() as Env);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const send = serverTransport.send.bind(serverTransport);
    serverTransport.send = (message, ...rest) =>
      send(JSON.parse(JSON.stringify(message)), ...rest);
    client = new Client({ name: "relay-client", version: "0.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    await client.listTools();
  });

  afterEach(async () => {
    restoreFetch();
    await client?.close();
    client = undefined;
  });

  it("delivers top-level _meta bt/relay and keeps structuredContent valid", async () => {
    const result = await client!.callTool({
      name: "fetch_obs_study_manual",
      arguments: { reference: "1:5", language: "en", format: "json" },
    });
    expect(result.isError).toBeFalsy();
    const meta = (result as { _meta?: Record<string, unknown> })._meta;
    const blocks = meta?.["bt/relay"] as RelayBlock[] | undefined;
    expect(blocks).toBeDefined();
    expect(blocks!.some((b) => b.id === "obs-en-01-05-observation")).toBe(true);
    expect(blocks!.some((b) => b.id === "obs-en-01-05-text")).toBe(true);

    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc).not.toHaveProperty("bt/relay");
    const shape = Object.fromEntries(
      Object.entries(fetchObsStudyManualTool.outputSchema!).map(([k, v]) => [
        k,
        v,
      ]),
    );
    const schema = z.object(shape).passthrough();
    expect(schema.safeParse(sc).success).toBe(true);
  });
});
