import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyTransclusionsToStory,
  parseObsTfStoryMarkdown,
} from "../../src/content/obsTfParser.js";
import { parseObsTfReference } from "../../src/content/obsTfReference.js";
import {
  buildStudyManualPayload,
  formatStudyManualMd,
  formatStudyManualText,
  renderStudyManual,
} from "../../src/content/studyManual.js";
import type { StoryBundle } from "../../src/content/contentService.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures", "en_obs_tf");

function loadBundle(): StoryBundle {
  const md = readFileSync(path.join(fixtureDir, "obs_story_1.md"), "utf8");
  const tx = (name: string) =>
    readFileSync(path.join(fixtureDir, "transclusions", name), "utf8");
  const files = new Map<string, string>([
    ["movement_2_drafting", tx("movement_2_drafting.md")],
    ["movement_3_checking", tx("movement_3_checking.md")],
    ["movement_4", tx("movement_4.md")],
    ["movement_5", tx("movement_5.md")],
    ["conclusion", tx("conclusion.md")],
    ["obs-devotionals-unit-3", tx("obs-devotionals-unit-3.md")],
  ]);
  let story = parseObsTfStoryMarkdown(md);
  story = applyTransclusionsToStory(story, files);
  return {
    language: "en",
    story,
    communityStudy: "Community study fixture text",
    cacheStatus: "hit" as const,
    downstreamApiCalls: 0,
    sourceKind: "dcs" as const,
  };
}

describe("studyManual (#36)", () => {
  it("builds whole-story payload with sections", () => {
    const ref = parseObsTfReference("1")!;
    const payload = buildStudyManualPayload(loadBundle(), { ref });
    expect(payload.resourceType).toBe("obs-tf");
    expect(payload.reference).toBe("1");
    expect(payload.communityStudy).toBeTruthy();
    expect(payload.movements).toHaveLength(5);
    expect(payload.sections.movement1_biblicalInterpretation).toBeTruthy();
    expect(payload.sections.movement4_ministryPractice?.markdown.length).toBeGreaterThan(
      20,
    );
    expect(payload.drafting).toMatch(/Translation Draft|draft/i);
    expect(payload.checking).toMatch(/Team Check|Accurate/i);
    expect(payload.conclusion).toMatch(/Conclusion|community/i);
    expect(payload.sessionFlow).toContain("drafting");
    expect(payload.sections.drafting).toBeTruthy();
  });

  it("filters by part=drafting and part=conclusion", () => {
    const ref = parseObsTfReference("1")!;
    const drafting = buildStudyManualPayload(loadBundle(), {
      ref,
      part: "drafting",
    });
    expect(drafting.part).toBe("drafting");
    expect(drafting.drafting).toBeTruthy();
    expect(drafting.communityStudy).toBeNull();
    expect(drafting.conclusion).toBeNull();

    const conclusion = buildStudyManualPayload(loadBundle(), {
      ref,
      part: "conclusion",
    });
    expect(conclusion.part).toBe("conclusion");
    expect(conclusion.conclusion).toMatch(/Conclusion/i);
    expect(conclusion.movements).toHaveLength(0);
  });

  it("filters by story:frame for observation questions", () => {
    const ref = parseObsTfReference("1:1")!;
    const payload = buildStudyManualPayload(loadBundle(), { ref });
    expect(payload.frames.every((f) => f.index === 1)).toBe(true);
    const m1 = payload.movements.find((m) => m.id === 1)!;
    expect(m1.observation?.every((b) => b.frameId === "01-01")).toBe(true);
    expect(m1.translation?.every((b) => b.frameId === "01-01")).toBe(true);
  });

  it("filters by movement and omits community study", () => {
    const ref = parseObsTfReference("1")!;
    const payload = buildStudyManualPayload(loadBundle(), {
      ref,
      movement: 2,
    });
    expect(payload.movements).toHaveLength(1);
    expect(payload.movements[0].id).toBe(2);
    expect(payload.communityStudy).toBeNull();
  });

  it("md and text formats are non-empty when JSON has content (#34 lesson)", () => {
    const ref = parseObsTfReference("1:1")!;
    const payload = buildStudyManualPayload(loadBundle(), { ref });
    const md = formatStudyManualMd(payload);
    const text = formatStudyManualText(payload);
    expect(md.length).toBeGreaterThan(100);
    expect(md).toMatch(/Observation Questions|Story frames|Movement/);
    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toMatch(/No .* found/i);

    const rendered = renderStudyManual(payload, "md");
    expect(typeof rendered.content).toBe("string");
    expect((rendered.content as string).trim().length).toBeGreaterThan(0);
  });

  it("md includes drafting, checking, and conclusion for whole story", () => {
    const ref = parseObsTfReference("1")!;
    const payload = buildStudyManualPayload(loadBundle(), { ref });
    const md = formatStudyManualMd(payload);
    expect(md).toMatch(/Translation Draft/i);
    expect(md).toMatch(/Team Check/i);
    expect(md).toMatch(/## Conclusion/);
  });
});
