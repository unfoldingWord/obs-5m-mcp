/**
 * MCP outputSchema conformance (SDK 1.15+ validates structuredContent).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  notAvailable,
  withNotAvailableOutput,
} from "../../src/mcp/tools/shared.js";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import { listLanguagesTool } from "../../src/mcp/tools/listLanguages.js";
import { listResourcesTool } from "../../src/mcp/tools/listResources.js";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";

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
        _meta: { downstream_api_calls: 0, cache_status: "hit" },
      }).success,
    ).toBe(true);
  });
});
