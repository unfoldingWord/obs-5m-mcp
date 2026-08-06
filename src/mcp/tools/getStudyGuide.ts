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

export const getStudyGuideTool: ToolModule<typeof inputSchema> = {
  name: "get_study_guide",
  description:
    "Full Five Movements session bundle for a story: intro, frames, community study, movements " +
    "(with drafting/checking), and conclusion. Prefer fetch_obs_study_manual for paced part= slices (#36).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    story: z.number().optional(),
    title: z.string().optional(),
    intro: z.record(z.unknown()).optional(),
    frames: z.array(z.record(z.unknown())).optional(),
    bibleSource: z.string().nullable().optional(),
    communityStudy: z.string().nullable().optional(),
    drafting: z.string().nullable().optional(),
    checking: z.string().nullable().optional(),
    conclusion: z.string().nullable().optional(),
    movements: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "Get Study Guide" },
  async handler(params, env) {
    try {
      const storyNum = coerceStoryNumber(params.story);
      const bundle = await loadStoryBundle(params.language, storyNum, env);
      const m2 = bundle.story.movements.find((m) => m.id === 2);
      const m3 = bundle.story.movements.find((m) => m.id === 3);
      const data = {
        language: bundle.language,
        story: storyNum,
        title: bundle.story.meta.subtitle,
        intro: bundle.story.intro,
        frames: bundle.story.frames,
        bibleSource: bundle.story.bibleSource,
        communityStudy: bundle.communityStudy,
        drafting: m2?.drafting ?? null,
        checking: m3?.checking ?? null,
        conclusion: bundle.story.conclusion,
        movements: bundle.story.movements,
      };
      return ok(
        data,
        `Study guide: story ${storyNum} (${bundle.story.meta.subtitle})`,
        partnerMeta(
          bundle.downstreamApiCalls,
          bundle.cacheStatus === "hit" ? "hit" : "miss",
        ),
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS-TF study guide", err.message);
      }
      throw err;
    }
  },
};
