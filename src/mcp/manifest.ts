import { VERSION, SERVER_NAME } from "../core/version.js";
import { MCP_TOOLS } from "./toolRegistry.js";

export function buildMcpManifest(opts: { mcpEndpoint: string }) {
  return {
    name: SERVER_NAME,
    version: VERSION,
    description:
      "OBS + Theological Formation (Five Movements) MCP — Door43 en_obs_tf + self-hosted Indonesian PDFs",
    mcpEndpoint: opts.mcpEndpoint,
    license: "Content: CC BY-SA 4.0 (unfoldingWord / partners)",
    tools: MCP_TOOLS.map((t) => ({
      name: t.name,
      title: t.annotations.title,
      description: t.description,
      readOnlyHint: t.annotations.readOnlyHint,
    })),
    resultEnvelope: {
      success: "structuredContent + content JSON; isError false",
      notAvailable:
        "{ available: false, code: RESOURCE_NOT_AVAILABLE, message, hints }",
      meta: {
        downstream_api_calls: "number",
        cache_status: "hit|miss|partial",
        response_size_bytes: "number",
      },
    },
    exampleResponse: {
      tool: "fetch_obs_study_manual",
      args: {
        reference: "1:1",
        language: "en",
        format: "json",
      },
      notes:
        "TH #36: story:frame keyed study manual — communityStudy + movements with Q&A; optional movement 1–5; format json|md|text",
    },
    relatedIssues: {
      "translation-helps-mcp#36": "Implemented here as fetch_obs_study_manual",
      "translation-helps-mcp#34": "Classic OBS tn/tq formatters — Translation Helps MCP",
      "translation-helps-mcp#35": "OBS twl — Translation Helps MCP",
      "bt-servant-engine#215": "Partner MCP + Indonesian PDFs",
    },
  };
}
