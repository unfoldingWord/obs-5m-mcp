/**
 * OBS skillChat — chat router (TH-style, OBS-shaped paths).
 *
 * Paths:
 *   I  — intro greeting (intent=intro)
 *   F  — framework / Five Movements explain (get_framework)
 *   P  — facilitate a session part (fetch_obs_study_manual)
 *   S  — story focus change (meta + brief confirm)
 *   M  — workflow mode change (meta + brief confirm)
 *   A  — open-ended agentic tool loop
 */

import type { Env } from "../mcp/agent.js";
import { TOOL_REGISTRY } from "../mcp/toolRegistry.js";
import { OpenAIClient, type OpenAIMessage } from "./openai.js";
import { runAgenticChat, type ChatMessage } from "./agenticLoop.js";
import { buildOpenAIToolSpecs } from "./toolSpecs.js";
import {
  AGENT_NAME,
  EZER_SYSTEM_BASE,
  workflowModePromptBias,
} from "./ezerPersona.js";
import {
  detectObsIntent,
  partFacilitationInstruction,
} from "./obsIntent.js";
import {
  parseSessionRole,
  sessionRoleIntroHint,
  sessionRolePromptBias,
  type SessionRole,
} from "./sessionRole.js";

export interface StreamEmit {
  status: (text: string) => void;
  token: (text: string) => void;
  meta?: (data: Record<string, unknown>) => void;
  done: (data: Record<string, unknown>) => void;
  error: (message: string) => void;
}

export interface SessionOpts {
  language: string;
  story: number;
  mode: string;
  role?: SessionRole | string;
  part?: string | null;
  workflowModeExplicit?: boolean;
}

function buildSystemPrompt(opts: SessionOpts, extra?: string): string {
  const role = parseSessionRole(opts.role);
  const parts = [
    EZER_SYSTEM_BASE,
    "",
    "Session defaults from the chat UI (override only if the user clearly asks):",
    `- language: ${opts.language}`,
    `- story: ${opts.story} (use reference "${opts.story}" or "${opts.story}:N" for frames)`,
    `- ${workflowModePromptBias(opts.mode)}`,
    `- ${sessionRolePromptBias(role)}`,
  ];
  if (opts.part) {
    parts.push(`- last selected session part: ${opts.part}`);
  }
  parts.push(
    "",
    "Tool discipline:",
    "- Presenting study content: ALWAYS call fetch_obs_study_manual with format=\"md\" (not json). Read the `content` markdown field.",
    "- Live facilitation: one part at a time (part=intro|frames|community|movement1–5|drafting|checking|conclusion).",
    "- Whole / compiled lesson: part=\"full\" (or omit part) with format=\"md\", then present that markdown (do not invent questions).",
    "- Use get_framework for movement definitions; list_collections / list_stories to pick stories.",
  );
  if (extra) {
    parts.push("", "## Turn directive", extra);
  }
  return parts.join("\n");
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
): Promise<unknown> {
  const tool = TOOL_REGISTRY[name];
  if (!tool) return { error: `Unknown tool: ${name}` };
  const parsed = tool.inputSchema.parse(args);
  const result = await tool.handler(parsed as never, env, crypto.randomUUID());
  return result.structuredContent ?? { content: result.content };
}

async function fetchStudyPartMd(
  env: Env,
  story: number,
  language: string,
  part: string,
): Promise<{ md: string; ok: boolean }> {
  try {
    const raw = await callTool(
      "fetch_obs_study_manual",
      {
        reference: String(story),
        language,
        part,
        format: "md",
      },
      env,
    );
    const obj = raw as Record<string, unknown>;
    if (typeof obj.content === "string" && obj.content.trim()) {
      return { md: obj.content, ok: true };
    }
    if (obj.available === false) {
      return {
        md: `Resource not available: ${String(obj.message ?? "unknown")}`,
        ok: false,
      };
    }
    return { md: JSON.stringify(raw).slice(0, 8_000), ok: false };
  } catch (err) {
    return {
      md: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    };
  }
}

async function streamLlmText(
  client: OpenAIClient,
  system: string,
  user: string,
  emit: StreamEmit,
  maxTokens = 400,
): Promise<string> {
  const messages: OpenAIMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const chunks: string[] = [];
  for await (const delta of client.generateStream(messages, { maxTokens })) {
    emit.token(delta);
    chunks.push(delta);
  }
  return chunks.join("");
}

/**
 * Stream Ezer's first-turn introduction (TH streamIntroGreeting analogue).
 */
export async function streamIntroGreeting(
  client: OpenAIClient,
  opts: SessionOpts,
  emit: StreamEmit,
): Promise<void> {
  emit.status(`${AGENT_NAME} is greeting you…`);

  const role = parseSessionRole(opts.role);
  const systemMsg = [
    `You are ${AGENT_NAME} — a theological formation coach for Open Bible Stories + Five Movements.`,
    `Your name means "helper" in Hebrew; mention that briefly when you introduce yourself.`,
    `Write in clear, warm language the user can follow (default English unless they asked otherwise; study language code: ${opts.language}).`,
    `Do not use markdown headings or long bullet lists.`,
    `Reply in 2–4 short sentences.`,
    `Explain in one breath that you help with OBS stories (50 stories, Creation to New Creation) and the Five Movements: observe → discuss → reflect → serve → share.`,
    sessionRoleIntroHint(role),
    `Do NOT assume or mention a specific story number (do not say story 1 or OBS 1).`,
    role === "member"
      ? `End with exactly ONE clear question: which Open Bible Story (1–50, or by title) they want to study.`
      : `End with exactly ONE clear question: which Open Bible Story (1–50, or by title) their group will start with.`,
  ].join(" ");

  const text = await streamLlmText(
    client,
    systemMsg,
    "Please introduce yourself and start the OBS formation conversation.",
    emit,
    280,
  );

  emit.done({
    response: text,
    intent: "intro",
    mode: "compose",
    agent: AGENT_NAME,
    story: opts.story,
    language: opts.language,
    toolCalls: [],
  });
}

/**
 * Main turn orchestrator — detect OBS intent, then facilitate or agentic.
 */
export async function answerStream(
  client: OpenAIClient,
  env: Env,
  history: ChatMessage[],
  opts: SessionOpts,
  emit: StreamEmit,
): Promise<void> {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const message = lastUser?.content?.trim() ?? "";
  if (!message) {
    emit.error("No user message provided");
    return;
  }

  const intent = detectObsIntent(message);
  const tools = buildOpenAIToolSpecs();
  let session = { ...opts, role: parseSessionRole(opts.role) };

  // Path R — leader vs member angle
  if (intent.kind === "role") {
    session = { ...session, role: intent.role };
    emit.meta?.({ setRole: intent.role });
    emit.status(intent.role === "member" ? "Member mode…" : "Leader mode…");
    const text = await streamLlmText(
      client,
      buildSystemPrompt(session),
      intent.role === "member"
        ? "Confirm you will help me as a group member (participant). In 2 short sentences, say how you'll support me, then ask which OBS story (1–50 or title) I want to study."
        : "Confirm you will help me as a group leader/trainer. In 2 short sentences, say how you'll coach facilitation, then ask which OBS story (1–50 or title) my group will start with.",
      emit,
      220,
    );
    emit.done({
      response: text,
      intent: "role",
      role: intent.role,
      toolCalls: [],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path M — mode change
  if (intent.kind === "mode" && !opts.workflowModeExplicit) {
    session = { ...session, mode: intent.mode };
    emit.meta?.({ setWorkflowMode: intent.mode });
  }

  // Path S — story focus (fetch intro from MCP, then orient)
  if (intent.kind === "story") {
    session = { ...session, story: intent.story, part: "intro" };
    emit.meta?.({ setStory: intent.story, setPart: "intro" });
    emit.status(`Loading story ${intent.story} intro from MCP…`);
    const fetched = await fetchStudyPartMd(
      env,
      intent.story,
      session.language,
      "intro",
    );
    const role = parseSessionRole(session.role);
    const system = [
      buildSystemPrompt(session),
      "",
      "You have OBS study-manual intro markdown below (already fetched via fetch_obs_study_manual).",
      role === "member"
        ? "Confirm the story title from the markdown, give a 2-sentence orientation for a group member, then ask whether to open Community Study, Movement 1, or the full lesson."
        : "Confirm the story title from the markdown, give a 2-sentence leader orientation, then ask whether to open Community Study, Movement 1, or the full lesson.",
      "Quote Key Idea / Creedal Verse / Metanarrative from the markdown. Do not invent them.",
      "",
      "INTRO_MARKDOWN:",
      fetched.md.slice(0, 40_000),
    ].join("\n");
    const text = await streamLlmText(client, system, message, emit, 1_200);
    emit.done({
      response: text,
      intent: "story",
      story: intent.story,
      part: "intro",
      toolCalls: [
        {
          name: "fetch_obs_study_manual",
          ok: fetched.ok,
          ms: 0,
          summary: fetched.ok
            ? `intro md (${fetched.md.length} chars)`
            : "intro fetch failed",
        },
      ],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path L — whole / compiled formatted lesson
  if (intent.kind === "lesson") {
    emit.status(`Compiling full lesson for story ${session.story}…`);
    emit.meta?.({ setPart: "full" });
    let lessonMd = "";
    let toolOk = false;
    try {
      const raw = await callTool(
        "fetch_obs_study_manual",
        {
          reference: String(session.story),
          language: session.language,
          part: "full",
          format: "md",
        },
        env,
      );
      const obj = raw as Record<string, unknown>;
      if (typeof obj.content === "string" && obj.content.trim()) {
        lessonMd = obj.content;
        toolOk = true;
      } else if (obj.available === false) {
        lessonMd = `Resource not available: ${String(obj.message ?? obj.error ?? "unknown")}`;
      } else {
        lessonMd = JSON.stringify(raw).slice(0, 8_000);
      }
    } catch (err) {
      lessonMd = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
    }

    const role = parseSessionRole(session.role);
    const system = [
      buildSystemPrompt(session),
      "",
      "You have the FULL formatted OBS study-manual markdown below (already fetched).",
      role === "member"
        ? "Present it for a group MEMBER: short orientation (2–3 sentences), then include the lesson markdown so they can study it. Do not invent questions."
        : "Present it for a GROUP LEADER: short facilitation orientation (how to use this packet), then include the lesson markdown. Do not invent questions.",
      "Keep your own prose short; the markdown body is the deliverable.",
      "If the content looks truncated or empty, say so and offer to open one part at a time.",
      "",
      "LESSON_MARKDOWN:",
      lessonMd.slice(0, 90_000),
    ].join("\n");

    const text = await streamLlmText(
      client,
      system,
      message,
      emit,
      8_000,
    );
    emit.done({
      response: text,
      intent: "lesson",
      part: "full",
      story: session.story,
      toolCalls: [
        {
          name: "fetch_obs_study_manual",
          ok: toolOk,
          ms: 0,
          summary: toolOk
            ? `full lesson md (${lessonMd.length} chars)`
            : "full lesson fetch failed",
        },
      ],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path F — framework explain
  if (intent.kind === "framework") {
    emit.status("Loading Five Movements framework…");
    emit.meta?.({ setPart: null });
    let frameworkJson = "";
    try {
      const fw = await callTool("get_framework", {}, env);
      frameworkJson = JSON.stringify(fw).slice(0, 12_000);
    } catch (err) {
      frameworkJson = `{"error":${JSON.stringify(String(err))}}`;
    }

    const system = [
      buildSystemPrompt(session),
      "",
      "You have get_framework JSON below. Explain as Ezer: who you are (helper), what OBS is, the Five Movements + Community/Conclusion framing, and how Study/Translate/Check map onto the session. Keep it tight (short paragraphs). End with ONE question offering to open Community Study or Movement 1 for the current story.",
      "",
      "FRAMEWORK_JSON:",
      frameworkJson,
    ].join("\n");

    const text = await streamLlmText(
      client,
      system,
      message,
      emit,
      700,
    );
    emit.done({
      response: text,
      intent: "framework",
      toolCalls: [{ name: "get_framework", ok: true, ms: 0 }],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path P — facilitate a part (always fetch MCP first; do not rely on the LLM to tool-call)
  if (intent.kind === "part") {
    session = { ...session, part: intent.part };
    emit.meta?.({ setPart: intent.part });
    emit.status(`Fetching ${intent.part} from MCP…`);
    const fetched = await fetchStudyPartMd(
      env,
      session.story,
      session.language,
      intent.part,
    );
    const role = parseSessionRole(session.role);
    const directive = partFacilitationInstruction(
      intent.part,
      session.story,
      session.language,
      role,
    );
    const system = [
      buildSystemPrompt(session, directive),
      "",
      "You have OBS study-manual markdown below (already fetched via fetch_obs_study_manual).",
      "Present it. Quote exact questions and wording. Do not invent content.",
      "",
      "PART_MARKDOWN:",
      fetched.md.slice(0, 90_000),
    ].join("\n");
    const text = await streamLlmText(client, system, message, emit, 2_400);
    emit.done({
      response: text,
      intent: "part",
      part: intent.part,
      story: session.story,
      toolCalls: [
        {
          name: "fetch_obs_study_manual",
          ok: fetched.ok,
          ms: 0,
          summary: fetched.ok
            ? `${intent.part} md (${fetched.md.length} chars)`
            : `${intent.part} fetch failed`,
        },
      ],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path M follow-through (mode only, no part)
  if (intent.kind === "mode") {
    emit.status(`Switching to ${session.mode}…`);
    const text = await streamLlmText(
      client,
      buildSystemPrompt(session),
      `The user switched to ${session.mode} mode for OBS story ${session.story}. In 2 sentences confirm the mode focus and ask which part to open first (suggest the first chip for that mode).`,
      emit,
      200,
    );
    emit.done({
      response: text,
      intent: "mode",
      workflowMode: session.mode,
      toolCalls: [],
      agent: AGENT_NAME,
    });
    return;
  }

  // Path A — open-ended agentic
  emit.status("Thinking…");
  const result = await runAgenticChat({
    client,
    env,
    history,
    tools,
    systemPrompt: buildSystemPrompt(session),
    onStatus: emit.status,
  });
  emit.status("Writing…");
  for (const chunk of chunkText(result.text || "", 40)) emit.token(chunk);
  emit.done({
    response: result.text,
    intent: "open_ended",
    toolCalls: result.toolCalls,
    agent: AGENT_NAME,
  });
}

function chunkText(text: string, size: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
