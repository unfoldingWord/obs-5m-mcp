import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";
import { buildToolCatalog } from "../../web/src/lib/catalog.js";

describe("buildToolCatalog", () => {
  it("documents every registered tool, primary tool first", () => {
    const docs = buildToolCatalog();
    expect(docs.map((d) => d.name).sort()).toEqual(MCP_TOOLS.map((t) => t.name).sort());
    expect(docs[0].name).toBe("fetch_obs_study_manual");
    expect(docs[0].group).toBe("primary");
    const groups = docs.map((d) => d.group);
    expect(groups).toEqual([...groups].sort((a, b) => ["primary", "discovery", "helpers"].indexOf(a) - ["primary", "discovery", "helpers"].indexOf(b)));
    for (const d of docs) {
      expect(d.inputSchema.type).toBe("object");
      expect(d.readOnly).toBe(true);
      expect(d.description.length).toBeGreaterThan(10);
    }
  });
});
