import { z } from "zod";
import {
  coerceStoryNumber,
  loadStoryBundle,
} from "../../content/contentService.js";
import { ErrorCode, isObs5mError } from "../../core/errors.js";
import {
  languageParam,
  notAvailable,
  ok,
  partnerMeta,
  storyParam,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({
  story: storyParam,
  language: languageParam,
});

export const getDevotionalTool: ToolModule<typeof inputSchema> = {
  name: "get_devotional",
  description:
    "Fetch the Community Study / devotion practice section linked from a story (resolved from obs-devotionals transclusions).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    story: z.number().optional(),
    title: z.string().optional(),
    communityStudy: z.string().nullable().optional(),
    ref: z.record(z.unknown()).nullable().optional(),
  }),
  annotations: { readOnlyHint: true, title: "Get Devotional" },
  async handler(params, env) {
    try {
      const storyNum = coerceStoryNumber(params.story);
      const bundle = await loadStoryBundle(params.language, storyNum, env);
      if (!bundle.communityStudy) {
        return notAvailable(
          "community study / devotion",
          "No resolvable Community Study transclusion for this story.",
        );
      }
      return ok(
        {
          language: bundle.language,
          story: storyNum,
          title: bundle.story.meta.subtitle,
          ref: bundle.story.communityStudyRef,
          communityStudy: bundle.communityStudy,
        },
        `Community study for story ${storyNum}`,
        partnerMeta(
          bundle.downstreamApiCalls,
          bundle.cacheStatus === "hit" ? "hit" : "miss",
        ),
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS-TF devotion", err.message);
      }
      throw err;
    }
  },
};
