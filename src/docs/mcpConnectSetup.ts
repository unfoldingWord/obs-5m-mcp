/** Shared MCP client setup-config snippets (aligned with Translation Helps). */

export function mcpEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/mcp`;
}

export function mcpConnectConfigs(baseUrl: string): {
  claude: string;
  cursor: string;
  http: string;
} {
  const mcp = mcpEndpoint(baseUrl);
  return {
    claude: `{
  "mcpServers": {
    "obs-tf": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${mcp}"]
    }
  }
}`,
    cursor: `{
  "mcpServers": {
    "obs-tf": {
      "url": "${mcp}"
    }
  }
}`,
    http: `POST ${mcp}
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
  };
}

export function renderMcpConnectSetup(baseUrl: string): string {
  const { claude, cursor, http } = mcpConnectConfigs(baseUrl);
  return `
      <p class="section-support" style="margin-top:0">
        Streamable HTTP MCP at <code>/mcp</code>. Same client setup as Translation Helps:
        Cursor uses a <code>url</code>; Claude Desktop uses <code>mcp-remote</code>.
        POST requires <code>Accept: application/json, text/event-stream</code>.
      </p>
      <div class="callout" style="margin-top:1.25rem">
        <strong>Cursor (<code>.cursor/mcp.json</code>)</strong>
        <pre style="margin:0.65rem 0 0">${cursor}</pre>
      </div>
      <div class="callout" style="margin-top:1rem">
        <strong>Claude Desktop / mcp-remote</strong>
        <pre style="margin:0.65rem 0 0">${claude}</pre>
      </div>
      <div class="callout" style="margin-top:1rem">
        <strong>Direct HTTP (Streamable MCP)</strong>
        <pre style="margin:0.65rem 0 0">${http}</pre>
      </div>`;
}
