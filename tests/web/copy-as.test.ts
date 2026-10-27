import { describe, expect, it } from "vitest";
import { curlFor, inspectorFor } from "../../web/src/lib/try/copyAs.js";
import { PRESETS } from "../../web/src/lib/try/presets.js";
import { MCP_TOOLS } from "../../src/mcp/toolRegistry.js";

describe("copy as", () => {
  it("builds a curl JSON-RPC call", () => {
    const cmd = curlFor("https://x/mcp", "list_stories", {});
    expect(cmd).toContain("-X POST");
    expect(cmd).toContain("Accept: application/json, text/event-stream");
    expect(cmd).toContain('"name":"list_stories"');
    expect(cmd).toContain("https://x/mcp");
  });

  it("builds an MCP Inspector CLI call", () => {
    const cmd = inspectorFor("https://x/mcp", "fetch_obs_study_manual", { reference: "1:5", part: "movement1" });
    expect(cmd).toContain("npx @modelcontextprotocol/inspector --cli https://x/mcp --transport http");
    expect(cmd).toContain("--method tools/call --tool-name fetch_obs_study_manual");
    expect(cmd).toContain("--tool-arg reference=1:5");
    expect(cmd).toContain("--tool-arg part=movement1");
  });

  it("quotes arguments with spaces or quotes for the shell", () => {
    const cmd = curlFor("https://x/mcp", "search_content", { query: "God's love" });
    expect(cmd).toMatch(/-d '.*God'\\''s love.*'/);
  });
});

describe("presets", () => {
  it("only use real tools", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    for (const p of PRESETS) expect(names).toContain(p.tool);
  });
});
