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
  formatStudyManualAssistantNote,
  formatStudyManualMd,
  renderStudyManual,
  STUDY_MANUAL_PARTS,
  STUDY_MANUAL_SECTIONS,
} from "../../content/studyManual.js";
import { ErrorCode, isObs5mError, Obs5mError } from "../../core/errors.js";
import {
  languageParam,
  notAvailable,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
  type ToolResult,
} from "./shared.js";

const REFERENCE_DESCRIPTION =
  "OBS story:frame reference into the study manual. " +
  'Examples: "1:1" (story 1, frame 1), "1:5-8" (frames 5 to 8), "1" (whole story), "1:0" (intro). ' +
  "A frame or range narrows the frames and the per-frame questions to those panels. " +
  'Optional "obs " prefix accepted. Use movement or part to fetch one session slice.';

const PART_DESCRIPTION =
  "Optional session part for translator workflows. " +
  "full (default) | intro | frames | community | movement1–movement5 | " +
  "drafting | checking | conclusion. " +
  "Content is always resolved (shared TX and story-unique inline look the same). " +
  "Prefer part over inventing your own section order; the second text block names the next part and its call.";

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
  include_answers: z
    .boolean()
    .optional()
    .describe(
      "Default true. Set false to leave out the manual's answers to the Observation Questions " +
        "(Movement 1) and the Discourse Questions (Movement 2), for a group working through them. " +
        "Everything else is returned as usual: the story, the Translation Questions, and every other part. " +
        'For a short list to hand to a team, add section: "observation".',
    ),
  section: z
    .enum(STUDY_MANUAL_SECTIONS)
    .optional()
    .describe(
      'Optional: only one Movement 1 list, "observation" (Observation Questions) or ' +
        '"translation" (Translation Questions). Implies part movement1.',
    ),
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
    "(unfoldingWord/translation-helps-mcp#36). " +
    "Relay the first text block to the user as written. The second text block is context for " +
    "you (where the part sits in the session, the call for the next part, source and licence); " +
    "do not show it to the user.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    resourceType: z.string().optional(),
    identifier: z.string().optional(),
    title: z.string().optional(),
    reference: z.string().optional(),
    language: z.string().optional(),
    story: z.number().optional(),
    frame: z.number().nullable().optional(),
    frameEnd: z.number().nullable().optional(),
    part: z.string().optional(),
    includeAnswers: z.boolean().optional(),
    section: z.string().nullable().optional(),
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
          `Invalid OBS reference: "${params.reference}". ` +
          'Use story, story:frame or story:first-last (e.g. "1", "1:1", "1:5-8").',
      });
    }
    if (
      params.section &&
      ((params.part && params.part !== "full" && params.part !== "movement1") ||
        (params.movement !== undefined && params.movement !== 1))
    ) {
      throw new Obs5mError({
        code: ErrorCode.INVALID_PARAMS,
        message:
          `section "${params.section}" is a Movement 1 list; use it with part movement1 (or no part).`,
      });
    }

    try {
      const bundle = await loadStoryBundle(params.language, ref.story, env);
      const payload = buildStudyManualPayload(bundle, {
        ref,
        movement: params.movement,
        part: params.part,
        includeAnswers: params.include_answers,
        section: params.section,
      });
      const rendered = renderStudyManual(payload, params.format);
      const note = formatStudyManualAssistantNote(payload, params.format);

      if (params.format === "json") {
        // Text content is the slice as markdown, ready to relay as written;
        // the data is in structuredContent. Sending the JSON as text too would
        // double the response for clients that read only text.
        return withNote(
          ok(
            payload,
            formatStudyManualMd(payload),
            partnerMeta(
              bundle.downstreamApiCalls,
              bundle.cacheStatus === "hit" ? "hit" : "miss",
            ),
            { jsonText: false },
          ),
          note,
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
        frameEnd: ref.frameEnd,
        part: payload.part,
        includeAnswers: payload.includeAnswers,
        section: payload.section,
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
      return withNote(
        ok(
          data,
          human ?? `OBS study manual ${ref.canonical} (${rendered.format})`,
          partnerMeta(
            bundle.downstreamApiCalls,
            bundle.cacheStatus === "hit" ? "hit" : "miss",
          ),
        ),
        note,
      );
    } catch (err) {
      if (isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
        return notAvailable("OBS study manual (obs-tf)", err.message);
      }
      throw err;
    }
  },
};

/** The note goes second: md/text keep the JSON copy as the last block. */
function withNote(result: ToolResult, note: string): ToolResult {
  result.content.splice(1, 0, { type: "text", text: note });
  return result;
}
