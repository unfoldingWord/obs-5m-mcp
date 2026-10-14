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

/**
 * Nothing could be searched. Keep the first failure's code and retry hint, so
 * a Door43 HTTP error stays a retryable upstream error and anything else is
 * reported as internal instead of being blamed on Door43.
 */
function allStoriesFailed(failedStories: number[], first: unknown): Obs5mError {
  const detail = first instanceof Error ? first.message : String(first);
  const message =
    `Could not load any story to search (failed: ${failedStories.join(", ")}). ` +
    `First error: ${detail}`;
  if (isObs5mError(first)) {
    return new Obs5mError({
      code: first.code,
      message: first.retryable ? `${message} Try again shortly.` : message,
      retryable: first.retryable,
    });
  }
  return new Obs5mError({ code: ErrorCode.INTERNAL_ERROR, message });
}

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
    let firstFailure: unknown;

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
        // Counted only once the story was actually searched.
        searched++;
      } catch (err) {
        // A story the language does not publish is expected. Anything else
        // (Door43 down, an HTTP 500, a parse error) leaves the scan
        // incomplete, and the result must say so rather than read as "no
        // matches".
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
        if (failedStories.length === 0) firstFailure = err;
        failedStories.push(n);
      }
    }

    if (searched === 0 && failedStories.length > 0) {
      throw allStoriesFailed(failedStories, firstFailure);
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
            "could not be searched, so results are incomplete"
          : ""),
      partnerMeta(downstream, anyMiss ? "partial" : "hit"),
    );
  },
};
