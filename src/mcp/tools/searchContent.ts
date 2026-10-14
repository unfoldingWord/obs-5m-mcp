import { z } from "zod";
import {
  loadStoryBundle,
  searchInStory,
} from "../../content/contentService.js";
import { ErrorCode, isObs5mError, Obs5mError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
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
    failedStories: z.array(z.number()).optional(),
  }),
  annotations: { readOnlyHint: true, title: "Search Content" },
  async handler(params, env, requestId) {
    const hits: Array<{
      story: number;
      title: string;
      field: string;
      snippet: string;
    }> = [];
    let downstream = 0;
    let anyMiss = false;
    let searched = 0;
    const failedStories: number[] = [];

    for (let n = 1; n <= params.maxStories; n++) {
      try {
        const bundle = await loadStoryBundle(params.language, n, env);
        searched++;
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
      } catch (err) {
        // A story the language does not publish is expected. Anything else
        // (Door43 down, an HTTP 500) leaves the scan incomplete, and the
        // result must say so rather than read as "no matches".
        if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
          continue;
        }
        logger.warn("search_content:story_failed", {
          tool: "search_content",
          requestId,
          language: params.language,
          story: n,
          code: isObs5mError(err) ? err.code : undefined,
          message: err instanceof Error ? err.message : String(err),
        });
        failedStories.push(n);
      }
    }

    if (searched === 0 && failedStories.length > 0) {
      throw new Obs5mError({
        code: ErrorCode.UPSTREAM_DCS_ERROR,
        message:
          `Could not load any story to search (${failedStories.length} failed: ` +
          `${failedStories.join(", ")}). Door43 may be unavailable; try again.`,
        retryable: true,
      });
    }

    const incomplete = failedStories.length > 0;
    return ok(
      {
        query: params.query,
        language: params.language,
        hits,
        ...(incomplete ? { failedStories } : {}),
      },
      `${hits.length} hit(s)` +
        (incomplete
          ? `; ${failedStories.length === 1 ? "story" : "stories"} ${failedStories.join(", ")} ` +
            "could not be searched (Door43 error), so results are incomplete"
          : ""),
      partnerMeta(downstream, anyMiss ? "partial" : "hit"),
    );
  },
};
