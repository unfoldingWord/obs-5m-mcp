import { z } from "zod";

export interface PromptModule {
  name: string;
  description: string;
  argsSchema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, string>) => {
    messages: Array<{
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }>;
  };
}

export const leadStorySession: PromptModule = {
  name: "lead_story_session",
  description:
    "Facilitation prompt for leading one OBS Five Movements story session.",
  argsSchema: {
    story: z.string().describe("Story number 1–50"),
    language: z.string().default("en").describe("Language code"),
  },
  handler(args) {
    const story = args.story ?? "1";
    const language = args.language ?? "en";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Lead a Five Movements OBS translation session for story ${story} (language ${language}). ` +
              `Call get_framework, then fetch_obs_study_manual with reference="${story}" and walk sessionFlow ` +
              `one part at a time (part=intro|frames|community|movement1|movement2|drafting|movement3|checking|` +
              `movement4|movement5|conclusion). Use the exact questions and frameworks returned; do not invent replacements. ` +
              `Keep the team on one part until they are ready to continue.`,
          },
        },
      ],
    };
  },
};

export const planFormationJourney: PromptModule = {
  name: "plan_formation_journey",
  description:
    "Plan a multi-story formation journey across OBS collections.",
  argsSchema: {
    language: z.string().default("en"),
    startCollection: z
      .string()
      .optional()
      .describe("Optional starting collection id 1–11"),
  },
  handler(args) {
    const language = args.language ?? "en";
    const start = args.startCollection ?? "1";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Plan an OBS Five Movements formation journey in language ${language}, starting at collection ${start}. ` +
              `Use list_collections and list_stories, then propose a paced sequence. Prefer fetch_obs_study_manual per story (part=full or walk sessionFlow).`,
          },
        },
      ],
    };
  },
};

export const PROMPTS: PromptModule[] = [
  leadStorySession,
  planFormationJourney,
];
