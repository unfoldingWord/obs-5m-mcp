import { MCP_TOOLS } from "../mcp/toolRegistry.js";

function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return (match ? match[1] : text).trim();
}

/** Plain-text summary for agents (https://llmstxt.org). */
export function buildLlmsTxt(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const lines = [
    "# OBS-TF MCP",
    "",
    "> A read-only MCP server that serves Open Bible Stories + Theological Formation " +
      "(OBS-TF): 50 Bible stories, each with the Five Movements study manual, " +
      "from the Door43 catalog. No key or sign-up is needed.",
    "",
    "## Endpoint",
    "",
    `- Streamable HTTP: ${base}/mcp`,
    "",
    "## Tools",
    "",
    ...MCP_TOOLS.map((t) => `- ${t.name}: ${firstSentence(t.description)}`),
    "",
    "## Links",
    "",
    `- Try it in the browser: ${base}/try`,
    `- Connect a client: ${base}/connect`,
    `- Tool reference: ${base}/tools`,
    `- Guide: ${base}/docs`,
    `- Tool manifest (JSON): ${base}/api/mcp-manifest`,
    "- Theological Formation: https://formationstories.org/",
    "- Source on Door43: https://git.door43.org/unfoldingWord/en_obs-tf",
    "",
  ];
  return lines.join("\n");
}
