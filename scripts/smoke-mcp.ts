/**
 * Live MCP smoke (like TH MCP health-check tools/list).
 *
 * Usage:
 *   npm run test:smoke
 *   SMOKE_URL=http://localhost:8790 npm run test:smoke
 *   SMOKE_URL=https://obs-5m-mcp….workers.dev npm run test:smoke
 */

const BASE = (process.env.SMOKE_URL ?? "http://localhost:8790").replace(
  /\/$/,
  "",
);

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function main() {
  console.log(`Smoke against ${BASE}`);

  const health = await fetch(`${BASE}/health`);
  if (!health.ok) fail(`/health → ${health.status}`);
  console.log("OK /health");

  const toolsList = await postJson("/mcp", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  if (!toolsList.ok) {
    // Some MCP transports return SSE; fall back to /api/mcp-manifest
    console.warn(
      `WARN /mcp tools/list HTTP ${toolsList.status} — checking manifest`,
    );
  } else {
    const text = await toolsList.text();
    if (!/fetch_obs_study_manual|list_resources/.test(text)) {
      fail("tools/list missing expected tool names");
    }
    console.log("OK /mcp tools/list");
  }

  const manifest = await fetch(`${BASE}/api/mcp-manifest`);
  if (!manifest.ok) fail(`/api/mcp-manifest → ${manifest.status}`);
  const man = (await manifest.json()) as { tools?: Array<{ name: string }> };
  const names = new Set((man.tools ?? []).map((t) => t.name));
  for (const required of [
    "fetch_obs_study_manual",
    "list_resources",
    "get_pdf",
    "get_framework",
  ]) {
    if (!names.has(required)) fail(`manifest missing ${required}`);
  }
  console.log(`OK /api/mcp-manifest (${names.size} tools)`);

  const study = await postJson("/api/tool", {
    tool: "fetch_obs_study_manual",
    arguments: { reference: "1:1", language: "en", format: "json" },
    debug: true,
  });
  if (!study.ok) fail(`/api/tool study → ${study.status}`);
  const studyBody = (await study.json()) as {
    result?: { structuredContent?: Record<string, unknown>; isError?: boolean };
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    xray?: unknown[];
    xrayReport?: string;
  };
  const sc =
    studyBody.result?.structuredContent ?? studyBody.structuredContent ?? {};
  const isError = studyBody.result?.isError ?? studyBody.isError;
  if (isError) fail("fetch_obs_study_manual returned isError");
  if (sc.resourceType !== "obs-tf" && sc.storyTitle !== "The Creation") {
    // When debug wrapper is used, fields are under result
    if ((sc as { storyTitle?: string }).storyTitle !== "The Creation") {
      // Accept either shape
      const nested = studyBody.result?.structuredContent as
        | { storyTitle?: string; resourceType?: string }
        | undefined;
      if (nested?.storyTitle !== "The Creation" && nested?.resourceType !== "obs-tf") {
        fail(
          `unexpected study payload: ${JSON.stringify(studyBody).slice(0, 400)}`,
        );
      }
    }
  }
  if (studyBody.xray && !Array.isArray(studyBody.xray)) {
    fail("debug xray should be an array");
  }
  if (studyBody.xrayReport && !/X-ray debug report/.test(studyBody.xrayReport)) {
    fail("xrayReport missing header");
  }
  console.log("OK fetch_obs_study_manual (+ xray)");

  const resources = await postJson("/api/tool", {
    tool: "list_resources",
    arguments: { language: "id" },
  });
  if (!resources.ok) fail(`list_resources id → ${resources.status}`);
  console.log("OK list_resources id");

  console.log("Smoke passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
