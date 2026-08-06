import { z } from "zod";
import { getCollections } from "../../content/contentService.js";
import {
  ok,
  partnerMeta,
  withNotAvailableOutput,
  type ToolModule,
} from "./shared.js";

const inputSchema = z.object({});

export const listCollectionsTool: ToolModule<typeof inputSchema> = {
  name: "list_collections",
  description:
    "List the 11 OBS story collections (Beginnings through Future Hope) used in the Five Movements journey.",
  inputSchema,
  outputSchema: withNotAvailableOutput({
    collections: z.array(z.record(z.unknown())).optional(),
  }),
  annotations: { readOnlyHint: true, title: "List Collections" },
  async handler() {
    const collections = getCollections();
    return ok(
      { collections },
      `${collections.length} collections`,
      partnerMeta(0, "hit"),
    );
  },
};
