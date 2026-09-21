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

export const getStoryTool: ToolModule<typeof inputSchema> = {
  name: "get_story",
  description:
    "Fetch OBS story introduction (key idea, creedal verse, metanarrative) and frame text for a story. English from Door43 catalog subject OBS Theological Formation (tc-ready).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    story: z.number().optional(),
    title: z.string().optional(),
    intro: z.record(z.unknown()).optional(),
    frames: z.array(z.record(z.unknown())).optional(),
    bibleSource: z.string().nullable().optional(),
  }),
  annotations: { readOnlyHint: true, title: "Get Story" },
  async handler(params, env) {
    try {
      const storyNum = coerceStoryNumber(params.story);
      const bundle = await loadStoryBundle(params.language, storyNum, env);
      const data = {
        language: bundle.language,
        story: bundle.story.meta.storyNum,
        title: bundle.story.meta.subtitle,
        intro: bundle.story.intro,
        frames: bundle.story.frames,
        bibleSource: bundle.story.bibleSource,
      };
      return ok(
        data,
        `Story ${storyNum}: ${bundle.story.meta.subtitle}`,
        partnerMeta(
          bundle.downstreamApiCalls,
          bundle.cacheStatus === "hit" ? "hit" : "miss",
        ),
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS-TF story", err.message);
      }
      throw err;
    }
  },
};
