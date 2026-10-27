/** JSON discovery document for `/` (Accept: application/json) and `/api`. */
export function apiDiscoveryJson(baseUrl: string, version: string, name: string) {
  const base = baseUrl.replace(/\/$/, "");
  return {
    name,
    version,
    mcp: "/mcp",
    tools: "/tools",
    connect: "/connect",
    docs: "/docs",
    manifest: "/api/mcp-manifest",
    health: "/health",
    tool: "/api/tool",
    llms: "/llms.txt",
    urls: {
      mcp: `${base}/mcp`,
      site: `${base}/`,
    },
  };
}
