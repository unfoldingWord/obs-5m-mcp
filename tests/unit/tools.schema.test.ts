import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";
import { notAvailable, ok, withNotAvailableOutput } from "../../src/mcp/tools/shared.js";
import { z } from "zod";

describe("tool registry", () => {
  it("registers expected tools", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toContain("list_languages");
    expect(names).toContain("list_resources");
    expect(names).toContain("fetch_obs_study_manual");
    expect(names).toContain("get_study_guide");
    expect(names).toContain("get_pdf");
    expect(names).toContain("search_content");
    expect(names).toHaveLength(12);
  });

  it("notAvailable validates against withNotAvailableOutput schema", () => {
    const schema = z.object(
      withNotAvailableOutput({
        story: z.number().optional(),
      }),
    );
    const result = notAvailable("test resource");
    expect(result.isError).toBe(false);
    expect(() => schema.parse(result.structuredContent)).not.toThrow();
  });

  it("ok attaches partner _meta", () => {
    const result = ok(
      { hello: "world" },
      "hi",
      { downstream_api_calls: 2, cache_status: "miss" },
    );
    expect(result.structuredContent?._meta).toMatchObject({
      downstream_api_calls: 2,
      cache_status: "miss",
    });
  });
});
