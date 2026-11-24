import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../../src/mcp/agent.js";
import { registerTools } from "../../src/mcp/registerTools.js";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import * as studyManualRelay from "../../src/content/studyManualRelay.js";
import {
  emptyEnv,
  loadFixture,
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

function expectQuestionOnlyObservationText(blocks: RelayBlock[]): void {
  for (const block of blocks.filter((b) => b.id.endsWith("-observation"))) {
    const lines = block.text.split("\n");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/^- /);
      expect(line.endsWith("?") || line.endsWith("？") || line.endsWith("؟")).toBe(
        true,
      );
    }
  }
}

/** Story 1 with a leaky multi-line answer on frame 01-05; 01-06 stays well-formed. */
function storyWithLeakyFrame05(): string {
  const base = loadFixture("obs_story_1.md");
  // Match the fixture's own ending (CRLF under Windows autocrlf, LF in git/CI).
  const nl = base.includes("\r\n") ? "\r\n" : "\n";
  const nlRe = nl === "\r\n" ? "\\r\\n" : "\\n";
  const leaky = [
    "#### 01-05  ",
    "Q1?  ",
    "A1 line one  ",
    "A1 line two  ",
    "Q2?  ",
    "A2",
    "",
    "",
  ].join(nl);
  const pattern = new RegExp(
    [
      "#### 01-05  ",
      "What else did God create on the third day\\?  ",
      "On the third day, God also created trees and plants\\.",
      "",
      "What was God's response to the trees and plants he created on the third day\\?  ",
      "He said they were good\\.",
      "",
      "",
    ].join(nlRe),
  );
  const replaced = base.replace(pattern, leaky);
  expect(replaced).not.toBe(base);
  return replaced;
}

describe("fetch_obs_study_manual relay blocks", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
    vi.restoreAllMocks();
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

  it.each([
    { label: "part=full", args: { reference: "1", part: "full" as const } },
    {
      label: "part=movement1",
      args: { reference: "1", part: "movement1" as const },
    },
    { label: "movement=1", args: { reference: "1", movement: 1 } },
    {
      label: "section=observation",
      args: { reference: "1", section: "observation" as const },
    },
    {
      label: "section=translation",
      args: { reference: "1", section: "translation" as const },
    },
  ])(
    "include_answers true and false yield the same bt/relay ($label)",
    async ({ label, args }) => {
      const base = { language: "en", format: "json" as const, ...args };
      const withAnswers = await fetchObsStudyManualTool.handler(
        { ...base, include_answers: true },
        emptyEnv(),
        `relay-eq-true-${args.reference}`,
      );
      const withoutAnswers = await fetchObsStudyManualTool.handler(
        { ...base, include_answers: false },
        emptyEnv(),
        `relay-eq-false-${args.reference}`,
      );
      expect(relayOf(withoutAnswers)).toEqual(relayOf(withAnswers));
      const obs =
        relayOf(withoutAnswers)?.filter((b) => b.id.endsWith("-observation")) ??
        [];
      if (label !== "section=translation") {
        expect(obs.length).toBeGreaterThan(0);
      }
      expectQuestionOnlyObservationText(obs);
    },
  );

  it("section=translation with include_answers:false has no observation relay block", async () => {
    const result = await fetchObsStudyManualTool.handler(
      {
        reference: "1",
        language: "en",
        section: "translation",
        include_answers: false,
        format: "json",
      },
      emptyEnv(),
      "relay-trans-no-obs",
    );
    const relay = relayOf(result);
    if (relay === undefined) {
      expect(result._meta).toBeUndefined();
    } else {
      expect(relay).toEqual(expect.any(Array));
      expect(relay.some((b) => b.id.endsWith("-observation"))).toBe(false);
    }
  });

  it("frame-filtered reference yields the same relay for include_answers and only that frame", async () => {
    const args = {
      reference: "1:5",
      language: "en",
      part: "movement1" as const,
      format: "json" as const,
    };
    const withAnswers = await fetchObsStudyManualTool.handler(
      { ...args, include_answers: true },
      emptyEnv(),
      "relay-frame-true",
    );
    const withoutAnswers = await fetchObsStudyManualTool.handler(
      { ...args, include_answers: false },
      emptyEnv(),
      "relay-frame-false",
    );
    expect(relayOf(withoutAnswers)).toEqual(relayOf(withAnswers));
    const blocks = relayOf(withoutAnswers) ?? [];
    const obs = blocks.filter((b) => b.id.endsWith("-observation"));
    expect(obs.map((b) => b.id)).toEqual(["obs-en-01-05-observation"]);
    for (const block of blocks) {
      expect(block.id).toMatch(/-01-05-/);
    }
  });

  it("include_answers:false on a leaky frame omits it but keeps a trusted frame in the same story", async () => {
    stubDcsFetch({
      storyMarkdownByRepo: { en_obs_tf: storyWithLeakyFrame05() },
    });
    const result = await fetchObsStudyManualTool.handler(
      {
        reference: "1",
        language: "en",
        part: "movement1",
        include_answers: false,
        format: "json",
      },
      emptyEnv(),
      "relay-leaky-story",
    );
    const blocks = relayOf(result) ?? [];
    expect(blocks.some((b) => b.id === "obs-en-01-05-observation")).toBe(
      false,
    );
    expect(blocks.some((b) => b.text.includes("A1 line two"))).toBe(false);
    expect(blocks.some((b) => b.id === "obs-en-01-06-observation")).toBe(true);
    expectQuestionOnlyObservationText(blocks);
  });

  it("include_answers:false content and structuredContent do not depend on relay blocks", async () => {
    const args = {
      reference: "1:5",
      language: "en",
      part: "movement1" as const,
      include_answers: false as const,
      format: "json" as const,
    };
    const real = await fetchObsStudyManualTool.handler(
      args,
      emptyEnv(),
      "relay-sc-real",
    );
    const spy = vi
      .spyOn(studyManualRelay, "buildStudyManualRelayBlocks")
      .mockReturnValue([]);
    const mocked = await fetchObsStudyManualTool.handler(
      args,
      emptyEnv(),
      "relay-sc-mock",
    );
    expect(mocked.content).toEqual(real.content);
    expect(mocked.structuredContent).toEqual(real.structuredContent);
    expect(relayOf(mocked)).toBeUndefined();
    expect(relayOf(real)?.length).toBeGreaterThan(0);
    spy.mockRestore();
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