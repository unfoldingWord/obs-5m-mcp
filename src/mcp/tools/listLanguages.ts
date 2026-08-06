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
    "List languages with OBS Five Movements content. Prefers DCS catalog (subject=OBS Theological Formation, topic=tc-ready); Indonesian may use self-hosted PDF text when absent from DCS.",
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
