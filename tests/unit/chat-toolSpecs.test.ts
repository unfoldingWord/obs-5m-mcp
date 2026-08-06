import { describe, expect, it } from "vitest";
import { buildOpenAIToolSpecs } from "../../src/chat/toolSpecs.js";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";

describe("buildOpenAIToolSpecs", () => {
  it("exposes one OpenAI function per MCP tool", () => {
    const specs = buildOpenAIToolSpecs();
    expect(specs).toHaveLength(MCP_TOOLS.length);
    for (const spec of specs) {
      expect(spec.type).toBe("function");
      expect(spec.function.name).toBeTruthy();
      expect(spec.function.parameters).toMatchObject({ type: "object" });
    }
    expect(specs.map((s) => s.function.name)).toContain("fetch_obs_study_manual");
  });
});
