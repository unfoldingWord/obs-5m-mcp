/**
 * OpenAI function specs derived from MCP tool modules.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MCP_TOOLS } from "../mcp/toolRegistry.js";
import type { OpenAITool } from "./openai.js";
import {
  EZER_SYSTEM_BASE,
  workflowModePromptBias,
} from "./ezerPersona.js";
import { parseSessionRole, sessionRolePromptBias } from "./sessionRole.js";

function zodObjectFromTool(tool: (typeof MCP_TOOLS)[number]): z.ZodObject<z.ZodRawShape> {
  const schema = tool.inputSchema;
  if (schema instanceof z.ZodEffects) {
    return schema.innerType() as z.ZodObject<z.ZodRawShape>;
  }
  return schema as z.ZodObject<z.ZodRawShape>;
}

export function buildOpenAIToolSpecs(): OpenAITool[] {
  return MCP_TOOLS.map((tool) => {
    const jsonSchema = zodToJsonSchema(zodObjectFromTool(tool), {
      $refStrategy: "none",
      target: "openApi3",
    }) as Record<string, unknown>;
    const { $schema: _s, ...parameters } = jsonSchema;
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description.slice(0, 1024),
        parameters: parameters.type
          ? parameters
          : { type: "object", properties: {} },
      },
    };
  });
}

/** @deprecated Prefer skillChat buildSystemPrompt; kept for agenticLoop default. */
export const CHAT_SYSTEM_PROMPT = EZER_SYSTEM_BASE;

export function buildChatSystemPrompt(opts?: {
  language?: string;
  story?: number;
  mode?: string;
  role?: string;
  part?: string | null;
}): string {
  const language = opts?.language?.trim() || "en";
  const story = opts?.story && opts.story >= 1 && opts.story <= 50 ? opts.story : 1;
  const mode = opts?.mode?.trim() || "study";
  const role = parseSessionRole(opts?.role);
  const lines = [
    EZER_SYSTEM_BASE,
    "",
    "Session defaults from the chat UI (override only if the user clearly asks):",
    `- language: ${language}`,
    `- story: ${story} (use reference "${story}" or "${story}:N" for frames)`,
    `- ${workflowModePromptBias(mode)}`,
    `- ${sessionRolePromptBias(role)}`,
  ];
  if (opts?.part) {
    lines.push(`- last selected session part: ${opts.part}`);
  }
  lines.push(
    "",
    "Tool discipline:",
    "1. Prefer fetch_obs_study_manual with format=\"md\" when presenting content (read the content field).",
    "2. Default language is en unless the user asks otherwise; for id use converted OBS-TF markdown.",
    "3. Live pacing: part= intro|frames|community|movement1–5|drafting|checking|conclusion.",
    "4. Whole lesson: part=\"full\" format=\"md\" — then present that markdown; do not invent questions.",
    "5. Use get_framework for movement definitions, formationPlan, and sessionFlow.",
    "6. get_pdf only when the user wants the Indonesian PDF file.",
  );
  return lines.join("\n");
}
