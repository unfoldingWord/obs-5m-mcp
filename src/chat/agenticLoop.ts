/**
 * Bounded OpenAI tool-calling loop (TH MCP open_ended path, simplified).
 */

import type { Env } from "../mcp/agent.js";
import { TOOL_REGISTRY } from "../mcp/toolRegistry.js";
import { xrayPush } from "../core/xray/context.js";
import {
  OpenAIClient,
  type OpenAIMessage,
  type OpenAITool,
} from "./openai.js";
import { CHAT_SYSTEM_PROMPT } from "./toolSpecs.js";

const MAX_ITERATIONS = 8;
/** Full OBS lessons are ~25–80k markdown; keep room for one compiled lesson. */
const RESULT_CHAR_CAP = 100_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgenticResult {
  text: string;
  toolCalls: Array<{ name: string; ok: boolean; ms: number; summary?: string }>;
  messagesForStream: OpenAIMessage[];
}

function truncateToolResult(value: unknown): string {
  // Prefer lean md/text study-manual shape for the model.
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (
      typeof v.content === "string" &&
      (v.format === "md" || v.format === "text")
    ) {
      const lean: Record<string, unknown> = {
        format: v.format,
        reference: v.reference,
        language: v.language,
        story: v.story,
        part: v.part,
        storyTitle: v.storyTitle,
        sessionFlow: v.sessionFlow,
        sections: v.sections,
        content: v.content,
      };
      let raw = JSON.stringify(lean);
      if (raw.length <= RESULT_CHAR_CAP) return raw;
      const overhead = raw.length - v.content.length;
      const budget = Math.max(4_000, RESULT_CHAR_CAP - overhead - 120);
      lean.content =
        v.content.slice(0, budget) +
        "\n\n…[truncated — call fetch_obs_study_manual again with a specific part= to continue]";
      return JSON.stringify(lean);
    }
  }
  const raw = JSON.stringify(value);
  if (raw.length <= RESULT_CHAR_CAP) return raw;
  return (
    raw.slice(0, RESULT_CHAR_CAP) +
    '…[truncated — retry with format:"md" and a specific part=]'
  );
}

async function callToolInProcess(
  name: string,
  args: Record<string, unknown>,
  env: Env,
): Promise<{ ok: boolean; payload: unknown; ms: number; summary?: string }> {
  const tool = TOOL_REGISTRY[name];
  const t0 = Date.now();
  if (!tool) {
    return {
      ok: false,
      payload: { error: `Unknown tool: ${name}` },
      ms: 0,
    };
  }
  try {
    const parsed = tool.inputSchema.parse(args);
    const result = await tool.handler(parsed as never, env, crypto.randomUUID());
    const ms = Date.now() - t0;
    const summary =
      result.content?.find((c) => c.type === "text")?.text?.slice(0, 160) ??
      undefined;
    xrayPush({
      type: "tool_call",
      name,
      params: args,
      ms,
      ok: result.isError !== true,
      summary,
      cacheStatus: result.cacheStatus,
      resultSnapshot: result.structuredContent,
    });
    return {
      ok: result.isError !== true,
      payload: result.structuredContent ?? { content: result.content },
      ms,
      summary,
    };
  } catch (err) {
    const ms = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    xrayPush({
      type: "tool_call",
      name,
      params: args,
      ms,
      ok: false,
      error: message,
    });
    return { ok: false, payload: { error: message }, ms };
  }
}

export async function runAgenticChat(options: {
  client: OpenAIClient;
  env: Env;
  history: ChatMessage[];
  tools: OpenAITool[];
  systemPrompt?: string;
  onStatus?: (text: string) => void;
}): Promise<AgenticResult> {
  const { client, env, history, tools, onStatus } = options;
  const messages: OpenAIMessage[] = [
    { role: "system", content: options.systemPrompt ?? CHAT_SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolCalls: AgenticResult["toolCalls"] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    onStatus?.(i === 0 ? "Thinking…" : `Tool round ${i}…`);
    const turn = await client.generateWithTools(messages, tools, {
      maxTokens: 2048,
    });

    if (turn.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: turn.content,
        tool_calls: turn.tool_calls,
      });

      for (const tc of turn.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }
        onStatus?.(`Calling ${tc.function.name}…`);
        const result = await callToolInProcess(tc.function.name, args, env);
        toolCalls.push({
          name: tc.function.name,
          ok: result.ok,
          ms: result.ms,
          summary: result.summary,
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: truncateToolResult(result.payload),
        });
      }
      continue;
    }

    const text = (turn.content ?? "").trim();
    return { text, toolCalls, messagesForStream: messages };
  }

  return {
    text: "I hit the tool-call limit before finishing. Please ask a narrower question (e.g. one story or one movement).",
    toolCalls,
    messagesForStream: messages,
  };
}
