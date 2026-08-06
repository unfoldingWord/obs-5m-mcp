import { z } from "zod";
import { listStories } from "../../content/contentService.js";
import {
  languageParam,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({
  language: languageParam,
  collection: z
    .number()
    .int()
    .min(1)
    .max(11)
    .optional()
    .describe("Optional collection id (1–11) to filter stories."),
});

export const listStoriesTool: ToolModule<typeof inputSchema> = {
  name: "list_stories",
  description:
    "List OBS stories (1–50) with titles and collection membership. Optionally filter by collection id.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    stories: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "List Stories" },
  async handler(params, env) {
    const result = await listStories(params.language, env, params.collection);
    return ok(
      result,
      `${result.stories.length} stories`,
      partnerMeta(result.downstreamApiCalls, result.cacheStatus),
    );
  },
};
