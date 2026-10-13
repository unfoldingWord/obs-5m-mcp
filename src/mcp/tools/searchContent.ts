import { z } from "zod";
import {
  loadStoryBundle,
  searchInStory,
} from "../../content/contentService.js";
import {
  languageParam,
  notAvailable,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({
  query: z.string().min(2).describe("Lexical search query."),
  language: languageParam,
  maxStories: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Max stories to scan (default 10)."),
});

export const searchContentTool: ToolModule<typeof inputSchema> = {
  name: "search_content",
  description:
    "Lexical search over OBS-TF titles, key ideas, frames, and movement questions (DCS or PDF-text fallback). Scans up to maxStories stories.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    query: z.string().optional(),
    language: z.string().optional(),
    hits: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "Search Content" },
  async handler(params, env) {
    const hits: Array<{
      story: number;
      title: string;
      field: string;
      snippet: string;
    }> = [];
    let downstream = 0;
    let anyMiss = false;

    for (let n = 1; n <= params.maxStories; n++) {
      try {
        const bundle = await loadStoryBundle(params.language, n, env);
        downstream += bundle.downstreamApiCalls;
        if (bundle.cacheStatus === "miss") anyMiss = true;
        const found = searchInStory(bundle.story, params.query);
        for (const f of found) {
          hits.push({
            story: n,
            title: bundle.story.meta.subtitle,
            field: f.field,
            snippet: f.snippet,
          });
        }
      } catch {
        // skip missing stories
      }
    }

    return ok(
      { query: params.query, language: params.language, hits },
      `${hits.length} hit(s)`,
      partnerMeta(downstream, anyMiss ? "partial" : "hit"),
    );
  },
};
