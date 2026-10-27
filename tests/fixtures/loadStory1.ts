import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyTransclusionsToStory,
  parseObsTfStoryMarkdown,
} from "../../src/content/obsTfParser.js";
import type { StoryBundle } from "../../src/content/contentService.js";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "en_obs_tf");

/** English OBS-TF story 1 from the test fixtures, with its shared sections resolved. */
export function loadStory1(): StoryBundle {
  const md = readFileSync(path.join(fixtureDir, "obs_story_1.md"), "utf8");
  const tx = (name: string) =>
    readFileSync(path.join(fixtureDir, "transclusions", `${name}.md`), "utf8");
  const files = new Map<string, string>(
    [
      "movement_2_drafting",
      "movement_3_checking",
      "movement_4",
      "movement_5",
      "conclusion",
      "obs-devotionals-unit-3",
    ].map((n) => [n, tx(n)]),
  );
  const story = applyTransclusionsToStory(parseObsTfStoryMarkdown(md), files);
  return {
    language: "en",
    story,
    communityStudy: "Community study fixture text",
    cacheStatus: "hit" as const,
    downstreamApiCalls: 0,
    sourceKind: "dcs" as const,
  };
}
