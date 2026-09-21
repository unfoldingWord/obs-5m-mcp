import { describe, it, expect } from "vitest";
import {
  mcpConnectConfigs,
  mcpEndpoint,
  renderMcpConnectSetup,
} from "../../src/docs/mcpConnectSetup.js";

const BASE = "https://obs-5m-mcp.unfoldingword.workers.dev";

describe("mcpConnectSetup", () => {
  it("uses the Streamable HTTP /mcp URL", () => {
    expect(mcpEndpoint(BASE)).toBe(`${BASE}/mcp`);
    expect(mcpEndpoint(`${BASE}/`)).toBe(`${BASE}/mcp`);
  });

  it("matches TH-style Cursor url + mcp-remote configs", () => {
    const { claude, cursor, http } = mcpConnectConfigs(BASE);
    expect(JSON.parse(cursor)).toEqual({
      mcpServers: { "obs-tf": { url: `${BASE}/mcp` } },
    });
    expect(JSON.parse(claude)).toEqual({
      mcpServers: {
        "obs-tf": {
          command: "npx",
          args: ["-y", "mcp-remote", `${BASE}/mcp`],
        },
      },
    });
    expect(http).toContain(`POST ${BASE}/mcp`);
    expect(http).toContain("Accept: application/json, text/event-stream");
  });

  it("renders all three setup blocks", () => {
    const html = renderMcpConnectSetup(BASE);
    expect(html).toContain("Cursor");
    expect(html).toContain("Claude Desktop / mcp-remote");
    expect(html).toContain("Direct HTTP (Streamable MCP)");
    expect(html).toContain(`"url": "${BASE}/mcp"`);
  });
});
