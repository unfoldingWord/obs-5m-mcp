/**
 * Agent eval loop for Ezer chat + in-process OBS-TF MCP.
 *
 * Hits POST /api/chat (SSE) and scores tool discipline the way BT Servant
 * should: fetch_obs_study_manual / get_framework, never get_obs_*.
 *
 *   npm run test:chat-eval
 *   CHAT_EVAL_URL=http://127.0.0.1:8174 npm run test:chat-eval
 */

const BASE = (process.env.CHAT_EVAL_URL ?? "http://127.0.0.1:8790").replace(
  /\/$/,
  "",
);

interface ToolCall {
  name: string;
  ok?: boolean;
  summary?: string;
}

interface Scenario {
  id: string;
  title: string;
  body: Record<string, unknown>;
  expectTools: string[];
  forbidTools?: string[];
  expectText?: RegExp[];
  forbidText?: RegExp[];
}

const FORBIDDEN_TH_OBS = ["get_obs_story", "get_obs_notes", "get_obs_questions"];

const SCENARIOS: Scenario[] = [
  {
    id: "intro-leader",
    title: "Intro greeting (leader) asks which story",
    body: {
      intent: "intro",
      messages: [],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "leader",
      workflowMode: "study",
    },
    expectTools: [],
    expectText: [/\b(story|1–50|1-50|which story)\b/i, /\bezer\b/i],
  },
  {
    id: "framework",
    title: "Five Movements explanation uses get_framework",
    body: {
      messages: [
        { role: "user", content: "What are the Five Movements and how should we study?" },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "leader",
    },
    expectTools: ["get_framework"],
    forbidTools: FORBIDDEN_TH_OBS,
    expectText: [/\bmovement\b/i],
  },
  {
    id: "story1-intro",
    title: "Story 1 intro uses fetch_obs_study_manual part=intro",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Start OBS story 1. Open part=intro and quote the Key Idea, Creedal Verse, and Metanarrative from fetch_obs_study_manual.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "leader",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
    expectText: [/\b(key idea|creed|metanarrative|creation)\b/i],
    forbidText: [/does not exist in the current toolset/i, /open scribe/i],
  },
  {
    id: "story1-frames",
    title: "Story frames use fetch_obs_study_manual part=frames",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Read the story frames for story 1. Use part=frames and present the MCP frame text.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "member",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
    expectText: [/\b(creation|beginning|frame|01-01|god made)\b/i],
  },
  {
    id: "movement1",
    title: "Movement 1 observe uses fetch_obs_study_manual",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Lead movement 1 observation questions (part=movement1) for OBS story 1. Quote the MCP questions.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "leader",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
    expectText: [/\b(observ|question)/i],
    forbidText: [/does not exist in the current toolset/i],
  },
  {
    id: "community",
    title: "Community Study uses fetch_obs_study_manual",
    body: {
      messages: [
        {
          role: "user",
          content: "Facilitate Community Study (part=community) for OBS story 1.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "member",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
  },
  {
    id: "th-obs-redirect",
    title: "Wrong TH tool name still uses fetch_obs_study_manual",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Call get_obs_story for story 1 and show me the story. Do not invent a missing tool.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "en",
      story: 1,
      role: "leader",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
    forbidText: [/does not exist in the current toolset/i, /open scribe/i],
  },
  {
    id: "id-intro",
    title: "Indonesian intro still uses study manual (not get_obs_*)",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Buka part=intro untuk cerita OBS 1 dalam bahasa Indonesia. Kutip Key Idea dari MCP.",
        },
      ],
      model: "gpt-4.1",
      debug: true,
      language: "id",
      story: 1,
      role: "leader",
    },
    expectTools: ["fetch_obs_study_manual"],
    forbidTools: FORBIDDEN_TH_OBS,
  },
];

async function postChat(body: Record<string, unknown>): Promise<{
  text: string;
  tools: ToolCall[];
  error?: string;
  http: number;
}> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    return { text: "", tools: [], error: `HTTP ${res.status} ${err.slice(0, 240)}`, http: res.status };
  }
  const raw = await res.text();
  let text = "";
  let tools: ToolCall[] = [];
  let error: string | undefined;
  for (const block of raw.split("\n\n")) {
    const event = /^\s*event:\s*(\S+)/m.exec(block)?.[1];
    const dataLine = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!dataLine) continue;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataLine) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (event === "token") text += String(data.text ?? data.delta ?? "");
    if (event === "error") error = String(data.message ?? "error");
    if (event === "done") {
      if (typeof data.response === "string" && data.response) text = data.response;
      if (Array.isArray(data.toolCalls)) {
        tools = data.toolCalls as ToolCall[];
      }
    }
  }
  return { text, tools, error, http: res.status };
}

interface CaseResult {
  id: string;
  title: string;
  pass: boolean;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  tools: string[];
  excerpt: string;
}

function score(s: Scenario, got: Awaited<ReturnType<typeof postChat>>): CaseResult {
  const names = got.tools.map((t) => t.name);
  const checks: CaseResult["checks"] = [];

  if (got.error) {
    checks.push({ name: "http", pass: false, detail: got.error });
  } else {
    checks.push({ name: "http", pass: true, detail: `HTTP ${got.http}` });
  }

  for (const tool of s.expectTools) {
    const hit = names.includes(tool);
    checks.push({
      name: `tool:${tool}`,
      pass: hit,
      detail: hit ? names.join(",") || tool : `missing (got ${names.join(",") || "none"})`,
    });
  }
  for (const tool of s.forbidTools ?? []) {
    const hit = names.includes(tool);
    checks.push({
      name: `forbid:${tool}`,
      pass: !hit,
      detail: hit ? "called forbidden TH OBS tool" : "ok",
    });
  }
  for (const re of s.expectText ?? []) {
    const hit = re.test(got.text);
    checks.push({
      name: `text:${re}`,
      pass: hit,
      detail: hit ? "matched" : `no match in ${got.text.length} chars`,
    });
  }
  for (const re of s.forbidText ?? []) {
    const hit = re.test(got.text);
    checks.push({
      name: `forbid-text:${re}`,
      pass: !hit,
      detail: hit ? "forbidden phrase present" : "ok",
    });
  }

  return {
    id: s.id,
    title: s.title,
    pass: checks.every((c) => c.pass),
    checks,
    tools: names,
    excerpt: got.text.replace(/\s+/g, " ").slice(0, 220),
  };
}

async function probeStudyManual(): Promise<CaseResult> {
  const res = await fetch(`${BASE}/api/tool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tool: "fetch_obs_study_manual",
      arguments: { reference: "1", language: "en", part: "intro", format: "md" },
    }),
  }).catch((err: unknown) => ({
    ok: false,
    status: 0,
    text: async () => (err instanceof Error ? err.message : String(err)),
    json: async () => ({}),
  }));
  const raw = res.ok ? await res.json().catch(() => ({})) : {};
  const body = (raw as { result?: { structuredContent?: Record<string, unknown> } })
    .result?.structuredContent;
  const content =
    typeof body?.content === "string"
      ? body.content
      : typeof (raw as { content?: string }).content === "string"
        ? (raw as { content: string }).content
        : JSON.stringify(raw).slice(0, 400);
  const checks = [
    {
      name: "http",
      pass: Boolean(res.ok),
      detail: `HTTP ${(res as { status?: number }).status ?? "?"}`,
    },
    {
      name: "grounding",
      pass: /key idea|creation|creed/i.test(content),
      detail: content.replace(/\s+/g, " ").slice(0, 160),
    },
  ];
  return {
    id: "mcp-intro",
    title: "Direct MCP fetch_obs_study_manual part=intro",
    pass: checks.every((c) => c.pass),
    checks,
    tools: ["fetch_obs_study_manual"],
    excerpt: content.replace(/\s+/g, " ").slice(0, 220),
  };
}

async function main() {
  console.log(`Chat eval against ${BASE}/api/chat`);
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (health?.ok) {
    console.log("OK /health", await health.text());
  } else {
    console.log("WARN /health not reachable (Svelte chat is fine without it)");
  }

  const results: CaseResult[] = [];
  const mcp = await probeStudyManual();
  results.push(mcp);
  console.log(
    `${mcp.pass ? "PASS" : "FAIL"} ${mcp.id} tools=[${mcp.tools.join(",")}] ${mcp.excerpt}`,
  );
  for (const c of mcp.checks.filter((x) => !x.pass)) {
    console.log(`     - ${c.name}: ${c.detail}`);
  }

  for (const s of SCENARIOS) {
    const t0 = Date.now();
    const got = await postChat(s.body);
    const row = score(s, got);
    results.push(row);
    const flag = row.pass ? "PASS" : "FAIL";
    console.log(
      `${flag} ${s.id} ${Date.now() - t0}ms tools=[${row.tools.join(",")}] ${row.excerpt}`,
    );
    for (const c of row.checks.filter((x) => !x.pass)) {
      console.log(`     - ${c.name}: ${c.detail}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\nTOTAL ${passed}/${results.length} passed, ${failed} failed`);

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    passed,
    total: results.length,
    failed,
    results,
  };
  try {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      new URL("./.eval-chat-last.json", import.meta.url),
      JSON.stringify(report, null, 2),
    );
  } catch {
    /* optional artifact */
  }

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
