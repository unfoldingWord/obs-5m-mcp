import { z } from "zod";
import { listLanguages } from "../../content/contentService.js";
import {
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({});

export const listLanguagesTool: ToolModule<typeof inputSchema> = {
  name: "list_languages",
  description:
    "List languages with OBS Theological Formation content. Door43 catalog (subject=OBS Theological Formation, topic=tc-ready), plus languages with shipped converted markdown. Does not include PDF-only fallbacks.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    languages: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "List Languages" },
  async handler(_params, env) {
    const result = await listLanguages(env);
    return ok(
      result,
      `${result.languages.length} language(s)`,
      partnerMeta(
        result.downstreamApiCalls,
        result.cacheStatus === "hit" ? "hit" : "miss",
      ),
    );
  },
};
