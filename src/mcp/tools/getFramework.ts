import { z } from "zod";
import { getFramework } from "../../content/contentService.js";
import {
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({});

export const getFrameworkTool: ToolModule<typeof inputSchema> = {
  name: "get_framework",
  description:
    "Return the Five Movements framework: overview (why formation), movement definitions, Community Study / Conclusion framing, optional Formation Plan dialogues, sessionFlow, and CC BY-SA source links (Door43 + formationstories.org).",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    overview: z.record(z.unknown()).optional(),
    movements: z.array(z.record(z.unknown())).optional(),
    framing: z.record(z.unknown()).optional(),
    sessionFlow: z.array(z.string()).optional(),
    formationPlan: z.record(z.unknown()).optional(),
    source: z.record(z.unknown()).optional(),
  }),

  annotations: { readOnlyHint: true, title: "Get Framework" },
  async handler() {
    const data = getFramework();
    return ok(data, "Five Movements framework", partnerMeta(0, "hit"));
  },
};
