import { z } from "zod";
import type { Env } from "../agent.js";

export const LANGUAGE_DESCRIPTION =
  'BCP-47 language code. Prefers DCS catalog OBS Theological Formation (topic=tc-ready). ' +
  '"en" is on Door43; "id" falls back to self-hosted PDF text when DCS has no entry. Defaults to "en".';

export const languageParam = z
  .string()
  .min(2)
  .default("en")
  .describe(LANGUAGE_DESCRIPTION);

export const storyParam = z
  .union([z.string(), z.number()])
  .describe(
    'OBS story number 1–50, or a known English title (e.g. "The Creation").',
  );

export type AnyZodSchema =
  | z.ZodObject<z.ZodRawShape>
  | z.ZodEffects<z.ZodObject<z.ZodRawShape>>;

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  cacheStatus?: "hit" | "miss" | "partial" | "stale" | "none";
  /** Partner BT Servant budget metadata (also copied into structuredContent._meta). */
  meta?: {
    downstream_api_calls: number;
    cache_status: "hit" | "miss" | "partial";
    response_size_bytes?: number;
  };
}

export interface ToolModule<TInput extends AnyZodSchema> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: Record<string, z.ZodTypeAny>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    title: string;
  };
  handler(
    params: z.infer<TInput>,
    env: Env,
    requestId: string,
  ): Promise<ToolResult>;
}

export const notAvailableOutputFields = {
  available: z.boolean().optional(),
  code: z.literal("RESOURCE_NOT_AVAILABLE").optional(),
  message: z.string().optional(),
  hints: z.array(z.string()).optional(),
} as const;

/**
 * Budget metadata that `ok()` attaches to success payloads. It is declared on
 * every tool because the SDK advertises output schemas as closed objects
 * (additionalProperties: false): a client that validates structuredContent
 * rejects any field the schema does not name.
 */
export const metaOutputFields = {
  _meta: z.record(z.unknown()).optional(),
} as const;

export function withNotAvailableOutput(
  successFields: Record<string, z.ZodTypeAny>,
): Record<string, z.ZodTypeAny> {
  return {
    ...successFields,
    ...metaOutputFields,
    ...notAvailableOutputFields,
  };
}

export function ok(
  data: unknown,
  humanText?: string,
  meta?: ToolResult["meta"],
  opts?: {
    /**
     * When false, the text content is only `humanText` and the data travels
     * in structuredContent alone. Use it when `humanText` already is the full
     * content, so clients that read only text do not get it twice.
     */
    jsonText?: boolean;
  },
): ToolResult {
  const structured = {
    ...(data as Record<string, unknown>),
    ...(meta ? { _meta: meta } : {}),
  };
  const content: Array<{ type: "text"; text: string }> = [];
  if (humanText) content.push({ type: "text", text: humanText });
  if (opts?.jsonText !== false || !humanText) {
    content.push({ type: "text", text: JSON.stringify(structured) });
  }
  const json = JSON.stringify(structured);
  return {
    content,
    structuredContent: structured,
    isError: false,
    cacheStatus: meta?.cache_status ?? "none",
    meta: meta
      ? { ...meta, response_size_bytes: meta.response_size_bytes ?? json.length }
      : undefined,
  };
}

export function notAvailable(description: string, extra?: string): ToolResult {
  const message =
    `No ${description} available for this reference or language.` +
    (extra ? ` ${extra}` : "");
  const data = {
    available: false,
    code: "RESOURCE_NOT_AVAILABLE" as const,
    message,
    hints: [
      "Run list_resources to see what is available for this language.",
      "Use fetch_obs_study_manual for study content (DCS first; PDF text fallback for id).",
      "Use get_pdf only when you need the downloadable Indonesian PDF file.",
    ],
  };
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data as unknown as Record<string, unknown>,
    isError: false,
  };
}

export function partnerMeta(
  downstreamApiCalls: number,
  cacheStatus: "hit" | "miss" | "partial",
): ToolResult["meta"] {
  return {
    downstream_api_calls: downstreamApiCalls,
    cache_status: cacheStatus,
  };
}
