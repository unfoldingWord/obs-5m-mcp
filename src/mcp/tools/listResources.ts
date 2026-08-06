import { z } from "zod";
import { listResourcesForLanguage } from "../../content/contentService.js";
import {
  languageParam,
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({
  language: languageParam,
});

export const listResourcesTool: ToolModule<typeof inputSchema> = {
  name: "list_resources",
  description:
    "List OBS Five Movements resource types available for a language (structured obs-tf and/or self-hosted obs-tf-pdf).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    language: z.string().optional(),
    resources: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "List Resources" },
  async handler(params, env) {
    const data = await listResourcesForLanguage(params.language, env);
    return ok(
      data,
      `${data.resources.length} resource type(s) for ${params.language}`,
      partnerMeta(0, "hit"),
    );
  },
};
