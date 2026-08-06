/**
 * POST /api/chat — SSE stream (status / token / meta / done / error).
 * TH-compatible event taxonomy; OBS skillChat router underneath.
 */

import type { Env } from "../mcp/agent.js";
import { runWithXray } from "../core/xray/context.js";
import { XraySession } from "../core/xray/traceEvents.js";
import { formatXrayReport } from "../core/xray/formatReport.js";
import { OpenAIClient } from "./openai.js";
import type { ChatMessage } from "./agenticLoop.js";
import { answerStream, streamIntroGreeting, type StreamEmit } from "./skillChat.js";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY is not configured. Set it in .dev.vars (local) or `wrangler secret put OPENAI_API_KEY` (deploy).",
      },
      { status: 503, headers: cors },
    );
  }

  let body: {
    messages?: ChatMessage[];
    message?: string;
    model?: string;
    debug?: boolean;
    language?: string;
    story?: number | string;
    mode?: string;
    workflowMode?: string;
    workflowModeExplicit?: boolean;
    role?: string;
    part?: string | null;
    intent?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const isIntro = body.intent === "intro";

  const history: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages.filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
    : body.message
      ? [{ role: "user", content: String(body.message) }]
      : [];

  if (!isIntro && (!history.length || history[history.length - 1]?.role !== "user")) {
    return Response.json(
      { error: "Provide messages[] ending with a user turn, or message string." },
      { status: 400, headers: cors },
    );
  }

  const model = body.model || "gpt-4.1";
  const debug = Boolean(body.debug);
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "en";
  const storyNum = Number(body.story);
  const story =
    Number.isFinite(storyNum) && storyNum >= 1 && storyNum <= 50
      ? Math.trunc(storyNum)
      : 1;
  const rawMode = body.workflowMode ?? body.mode ?? "study";
  const mode =
    rawMode === "translate" || rawMode === "check" || rawMode === "study"
      ? rawMode
      : "study";
  const part =
    typeof body.part === "string" && body.part.trim() ? body.part.trim() : null;
  const role = body.role === "member" ? "member" : "leader";
  const sessionOpts = {
    language,
    story,
    mode,
    role,
    part,
    workflowModeExplicit: body.workflowModeExplicit === true,
  };

  const client = new OpenAIClient(env.OPENAI_API_KEY, model);
  const session = debug ? new XraySession() : null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(sse(event, data)));
      };

      const emit: StreamEmit = {
        status: (text) => send("status", { text }),
        token: (text) => send("token", { text }),
        meta: (data) => send("meta", data),
        done: (data) => {
          const xrayPayload = session
            ? {
                xray: session.done(),
                xrayReport: formatXrayReport(session.events, { tool: "chat" }),
              }
            : {};
          send("done", { ...data, ...xrayPayload });
        },
        error: (message) => {
          send("error", { message });
          send("done", { response: "", error: message, toolCalls: [], mode: "error" });
        },
      };

      try {
        const run = async () => {
          if (isIntro) {
            await streamIntroGreeting(client, sessionOpts, emit);
          } else {
            await answerStream(client, env, history, sessionOpts, emit);
          }
        };

        if (session) {
          await runWithXray(session, run);
        } else {
          await run();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit.error(message);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
