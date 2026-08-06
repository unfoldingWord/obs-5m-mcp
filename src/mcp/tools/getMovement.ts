import { z } from "zod";
import {
  coerceStoryNumber,
  loadStoryBundle,
  movementFromBundle,
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
  movement: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Five Movements id: 1 Observe … 5 Share."),
  language: languageParam,
});

export const getMovementTool: ToolModule<typeof inputSchema> = {
  name: "get_movement",
  description:
    "Fetch one Five Movements section for a story (1=Biblical Interpretation … 5=Missional Outreach). " +
    "Transclusions are resolved; movement 2 includes drafting, movement 3 includes checking when present.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    story: z.number().optional(),
    movement: z.record(z.unknown()).optional(),
  }),
  annotations: { readOnlyHint: true, title: "Get Movement" },
  async handler(params, env) {
    try {
      const storyNum = coerceStoryNumber(params.story);
      const bundle = await loadStoryBundle(params.language, storyNum, env);
      const movement = movementFromBundle(bundle, params.movement);
      return ok(
        {
          language: bundle.language,
          story: storyNum,
          title: bundle.story.meta.subtitle,
          movement,
        },
        `Story ${storyNum} movement ${params.movement}`,
        partnerMeta(
          bundle.downstreamApiCalls,
          bundle.cacheStatus === "hit" ? "hit" : "miss",
        ),
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS-TF movement", err.message);
      }
      throw err;
    }
  },
};
