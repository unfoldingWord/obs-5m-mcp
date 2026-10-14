import { z } from "zod";
import { listResourcesForLanguage } from "../../content/contentService.js";
import {
  languageParam,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({
  language: languageParam,
});

const resourceRowSchema = z.record(z.unknown());

/**
 * Success uses `available` as an array of rows; soft-NA uses boolean false.
 * Override after withNotAvailableOutput so both shapes validate (same as
 * Translation Helps v2 `list_resources`).
 */
const outputSchema = {
  ...withNotAvailableOutput({
    language: z.string().optional(),
    resources: z.array(resourceRowSchema).optional(),
  }),
  available: z
    .union([z.boolean(), z.array(resourceRowSchema)])
    .optional()
    .describe(
      "Success: rows that exist for the language. Soft-NA (RESOURCE_NOT_AVAILABLE): false.",
    ),
};

export const listResourcesTool: ToolModule<typeof inputSchema> = {
  name: "list_resources",
  description:
    "List OBS Theological Formation availability for a language. Returns structured obs-tf from the Door43 catalog (subject=OBS Theological Formation, topic=tc-ready) or shipped converted markdown. `available` lists the rows that exist for the language (empty when none); `resources` lists every row with a per-row `available` flag. Does not advertise PDF text as a study source.",
  inputSchema,
  outputSchema,
  annotations: { readOnlyHint: true, title: "List Resources" },
  async handler(params, env) {
    const { downstreamApiCalls, cacheStatus, ...data } =
      await listResourcesForLanguage(params.language, env);
    return ok(
      data,
      // Counts what exists, in Translation Helps v2 wording, so consumers
      // that cross-check the declared count against `available` can do so.
      `${data.available.length} resource(s) available for ${params.language}`,
      partnerMeta(downstreamApiCalls, cacheStatus),
    );
  },
};
