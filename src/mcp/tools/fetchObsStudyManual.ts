/**
 * fetch_obs_study_manual — BT Servant / TH MCP issue #36 surface.
 *
 * Returns en_obs_tf Five Movements study-manual content keyed by story:frame,
 * optionally filtered to one movement or session part. Supports format
 * json|md|text (all emit real content — avoids the #34 empty-md pitfall).
 */

import { z } from "zod";
import { loadStoryBundle } from "../../content/contentService.js";
import { parseObsTfReference } from "../../content/obsTfReference.js";
import {
  buildStudyManualPayload,
  renderStudyManual,
  STUDY_MANUAL_PARTS,
} from "../../content/studyManual.js";
import { ErrorCode, isObs5mError, Obs5mError } from "../../core/errors.js";
import {
  languageParam,
  notAvailable,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const REFERENCE_DESCRIPTION =
  "OBS story:frame reference into the study manual. " +
  'Examples: "1:1" (story 1, frame 1), "1" (whole story), "1:0" (intro). ' +
  'Optional "obs " prefix accepted. Use movement or part to fetch one session slice.';

const PART_DESCRIPTION =
  "Optional session part for translator workflows. " +
  "full (default) | intro | frames | community | movement1–movement5 | " +
  "drafting | checking | conclusion. " +
  "Content is always resolved (shared TX and story-unique inline look the same). " +
  "Prefer part over inventing your own section order; see sessionFlow in the response.";

const inputSchema = z.object({
  reference: z.string().min(1).describe(REFERENCE_DESCRIPTION),
  language: languageParam,
  movement: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe(
      "Optional Five Movements filter: 1=Biblical Interpretation … 5=Missional Outreach. " +
        "Prefer `part` when you need drafting/checking/conclusion specifically.",
    ),
  part: z
    .enum(STUDY_MANUAL_PARTS)
    .optional()
    .describe(PART_DESCRIPTION),
  format: z
    .enum(["json", "md", "text"])
    .default("json")
    .describe(
      'Output format. "json" (default) for structured data; "md" and "text" always render ' +
        "from the same parsed content (never empty when data exists).",
    ),
});

export const fetchObsStudyManualTool: ToolModule<typeof inputSchema> = {
  name: "fetch_obs_study_manual",
  description:
    "Fetch OBS + Theological Formation study-manual content for a translator session. " +
    "Resolves DCS (subject=OBS Theological Formation, topic=tc-ready) first; falls back to " +
    "converted local MD / PDF text. Returns intro, frames, Community Study, Five Movements " +
    "(observation, translation terms, discourse, theological, journal), plus drafting, " +
    "checking, ministry, missional, and conclusion — all packaging-resolved. " +
    "Use `part` to load one slice at a time. Preferred for BT Servant 5mOBS-translation " +
    "(unfoldingWord/translation-helps-mcp#36).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    resourceType: z.string().optional(),
    identifier: z.string().optional(),
    title: z.string().optional(),
    reference: z.string().optional(),
    language: z.string().optional(),
    story: z.number().optional(),
    frame: z.number().nullable().optional(),
    part: z.string().optional(),
    format: z.string().optional(),
    content: z.unknown().optional(),
    storyTitle: z.string().optional(),
    intro: z.record(z.unknown()).optional(),
    frames: z.array(z.record(z.unknown())).optional(),
    bibleSource: z.string().nullable().optional(),
    communityStudy: z.string().nullable().optional(),
    communityStudyRef: z.record(z.unknown()).nullable().optional(),
    drafting: z.string().nullable().optional(),
    checking: z.string().nullable().optional(),
    conclusion: z.string().nullable().optional(),
    movements: z.array(z.record(z.unknown())).optional(),
    sections: z.record(z.unknown()).optional(),
    sessionFlow: z.array(z.string()).optional(),
    source: z.record(z.unknown()).optional(),
  }),
  annotations: { readOnlyHint: true, title: "Fetch OBS Study Manual" },

  async handler(params, env) {
    const ref = parseObsTfReference(params.reference);
    if (!ref) {
      throw new Obs5mError({
        code: ErrorCode.INVALID_PARAMS,
        message:
          `Invalid OBS reference: "${params.reference}". Use story:frame (e.g. "1:1", "1").`,
      });
    }

    try {
      const bundle = await loadStoryBundle(params.language, ref.story, env);
      const payload = buildStudyManualPayload(bundle, {
        ref,
        movement: params.movement,
        part: params.part,
      });
      const rendered = renderStudyManual(payload, params.format);

      if (params.format === "json") {
        return ok(
          payload,
          `OBS study manual ${ref.canonical} (${params.language})` +
            (payload.part && payload.part !== "full"
              ? ` part=${payload.part}`
              : params.movement
                ? ` movement ${params.movement}`
                : ""),
          partnerMeta(
            bundle.downstreamApiCalls,
            bundle.cacheStatus === "hit" ? "hit" : "miss",
          ),
        );
      }

      // Lean payload for md/text: avoid duplicating movements + markdown body
      // (keeps chat/agent tool results under context limits).
      const data = {
        resourceType: "obs-tf",
        reference: ref.canonical,
        language: params.language,
        story: ref.story,
        frame: ref.frame,
        part: payload.part,
        format: rendered.format,
        content: rendered.content,
        storyTitle: payload.storyTitle,
        sections: payload.sections,
        sessionFlow: payload.sessionFlow,
        source: payload.source,
      };
      const human =
        typeof rendered.content === "string"
          ? rendered.content.slice(0, 2000)
          : undefined;
      return ok(
        data,
        human ?? `OBS study manual ${ref.canonical} (${rendered.format})`,
        partnerMeta(
          bundle.downstreamApiCalls,
          bundle.cacheStatus === "hit" ? "hit" : "miss",
        ),
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS study manual (obs-tf)", err.message);
      }
      throw err;
    }
  },
};
