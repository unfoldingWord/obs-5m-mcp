import { z } from "zod";
import {
  coerceStoryNumber,
  getPdfInfo,
} from "../../content/contentService.js";
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

export const getPdfTool: ToolModule<typeof inputSchema> = {
  name: "get_pdf",
  description:
    "Return self-hosted OBS Five Movements PDF URL and extracted plain text (when available). " +
    "Only for languages without DCS OBS Theological Formation (tc-ready) — currently Indonesian. " +
    "Prefer fetch_obs_study_manual for study/session content; use get_pdf when you need the downloadable PDF.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    story: z.number().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    r2Key: z.string().optional(),
    text: z.string().optional(),
    textAvailable: z.boolean().optional(),
    note: z.string().optional(),
  }),
  annotations: { readOnlyHint: true, title: "Get PDF" },
  async handler(params, env) {
    const storyNum = coerceStoryNumber(params.story);
    const info = getPdfInfo(params.language, storyNum, env);
    if (!info) {
      return notAvailable(
        "self-hosted PDF",
        `No PDF registered for language "${params.language}" story ${storyNum}. ` +
          `If DCS has OBS Theological Formation for this language, use fetch_obs_study_manual instead.`,
      );
    }
    const preview = info.text
      ? info.text.slice(0, 1500) + (info.text.length > 1500 ? "…" : "")
      : `PDF: ${info.title}`;
    return ok(info, preview, partnerMeta(0, "hit"));
  },
};
