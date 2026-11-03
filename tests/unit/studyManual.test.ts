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
  narrowMarkdownToRef,
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
    expect(payload.sections.movement1_biblicalInterpretation).toBe("movements[0]");
    expect(payload.sections.movement4_ministryPractice).toBe("movements[3]");
    expect(payload.movements[3].markdown?.length).toBeGreaterThan(20);
    // Whole story: drafting and checking sit in movements 2 and 3 only.
    expect(payload.movements[1].drafting).toMatch(/Translation Draft|draft/i);
    expect(payload.movements[2].checking).toMatch(/Team Check|Accurate/i);
    expect(payload.drafting).toBeNull();
    expect(payload.checking).toBeNull();
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

  it("narrows a frame range in lists, frames and markdown (#17)", () => {
    const ref = parseObsTfReference("1:5-8")!;
    const payload = buildStudyManualPayload(loadBundle(), {
      ref,
      part: "movement1",
    });
    expect(payload.reference).toBe("1:5-8");
    const m1 = payload.movements[0];
    const ids = ["01-05", "01-06", "01-07", "01-08"];
    expect(m1.observation?.map((b) => b.frameId)).toEqual(ids);
    expect(m1.translation?.map((b) => b.frameId)).toEqual(ids);
    // Parsed lists cover Movement 1, so its raw markdown is not repeated.
    expect(m1.markdown).toBeUndefined();
    const md = formatStudyManualMd(payload);
    expect(md).toMatch(/#### 01-05/);
    expect(md).not.toMatch(/01-04|01-09|01-16/);
  });

  it("a single frame no longer carries every panel (#17)", () => {
    const payload = buildStudyManualPayload(loadBundle(), {
      ref: parseObsTfReference("1:5")!,
      part: "movement1",
    });
    expect(JSON.stringify(payload)).not.toMatch(/01-16/);
  });

  it("narrowMarkdownToRef drops out-of-range panel and discourse blocks", () => {
    const md = [
      "## Movement",
      "Intro line",
      "### Observation Questions",
      "#### 01-01",
      "Q1",
      "#### 01-05",
      "Q5",
      "### Discourse Questions",
      "##### First? (01-01, 01-02)",
      "A1",
      "##### Middle? (01-04, 01-05)",
      "A2",
      "### Theological Questions",
      "1. T",
    ].join("\n");
    const out = narrowMarkdownToRef(md, parseObsTfReference("1:5")!);
    expect(out).toContain("Intro line");
    expect(out).toContain("Q5");
    expect(out).toContain("Middle?");
    expect(out).toContain("### Theological Questions");
    expect(out).not.toContain("Q1");
    expect(out).not.toContain("First?");
  });

  it("without answers drops only the Observation and Discourse answers (#17)", () => {
    const ref = parseObsTfReference("1")!;
    const leader = buildStudyManualPayload(loadBundle(), { ref });
    const group = buildStudyManualPayload(loadBundle(), { ref, includeAnswers: false });

    // Movement 1: questions stay, answers go; Translation Questions stay whole.
    const m1 = group.movements.find((m) => m.id === 1)!;
    expect(m1.observation).toHaveLength(16);
    for (const block of m1.observation ?? []) {
      for (const item of block.items) {
        expect(item.question.length).toBeGreaterThan(0);
        expect(item).not.toHaveProperty("answer");
      }
    }
    expect(m1.translation).toEqual(leader.movements.find((m) => m.id === 1)!.translation);
    expect(m1.markdown).toBeUndefined();

    // Movement 2: discourse questions without answers; theological questions stay.
    const m2 = group.movements.find((m) => m.id === 2)!;
    expect(m2.discourse?.length).toBeGreaterThan(0);
    for (const d of m2.discourse ?? []) {
      expect(d.question.length).toBeGreaterThan(0);
      expect(d.frameRefs.length).toBeGreaterThan(0);
      expect(d).not.toHaveProperty("answer");
    }
    expect(m2.theological).toEqual(leader.movements.find((m) => m.id === 2)!.theological);

    // The questions themselves are the leader's, word for word.
    const leaderM1 = leader.movements.find((m) => m.id === 1)!;
    const leaderM2 = leader.movements.find((m) => m.id === 2)!;
    expect(m1.observation).toEqual(
      leaderM1.observation?.map((b) => ({
        frameId: b.frameId,
        items: b.items.map((i) => ({ question: i.question })),
      })),
    );
    expect(m2.discourse).toEqual(
      leaderM2.discourse?.map((d) => ({ question: d.question, frameRefs: d.frameRefs })),
    );
    expect(m2.markdown).toBeUndefined();

    // Nothing else changes.
    expect(group.intro).toEqual(leader.intro);
    expect(group.frames).toEqual(leader.frames);
    expect(group.frames).toHaveLength(16);
    expect(group.bibleSource).toEqual(leader.bibleSource);
    expect(group.communityStudy).toEqual(leader.communityStudy);
    expect(group.conclusion).toEqual(leader.conclusion);
    for (const id of [3, 4, 5]) {
      expect(group.movements.find((m) => m.id === id)).toEqual(
        leader.movements.find((m) => m.id === id),
      );
    }

    const md = formatStudyManualMd(group);
    expect(md).not.toMatch(/\*\*A:\*\*/);
    expect(md).toMatch(/Translation Questions/);
    expect(md).toMatch(/Theological Questions/);
    expect(md).not.toContain("God took six days.");
  });

  it("each part without answers matches the leader view except Movements 1 and 2 (#17)", () => {
    const ref = parseObsTfReference("1")!;
    for (const part of ["intro", "frames", "community", "drafting", "movement3", "checking", "movement4", "movement5", "conclusion"] as const) {
      const leader = buildStudyManualPayload(loadBundle(), { ref, part });
      const group = buildStudyManualPayload(loadBundle(), { ref, part, includeAnswers: false });
      expect({ ...group, includeAnswers: true }, part).toEqual(leader);
    }
  });

  it("section with no answers is the short list to hand to a team (#17)", () => {
    const payload = buildStudyManualPayload(loadBundle(), {
      ref: parseObsTfReference("1:5-8")!,
      section: "observation",
      includeAnswers: false,
    });
    const m1 = payload.movements[0];
    expect(m1.observation).toHaveLength(4);
    expect(m1.observation?.[0].items[0]).not.toHaveProperty("answer");
    expect(m1.translation).toBeUndefined();
    expect(payload.frames).toEqual([]);
    expect(payload.intro).toBeUndefined();
    expect(payload.communityStudy).toBeNull();
    expect(payload.conclusion).toBeNull();
    const md = formatStudyManualMd(payload);
    expect(md).not.toMatch(/\*\*A:\*\*/);
    expect(md).not.toMatch(/Translation Questions/);
    expect(JSON.stringify(payload).length).toBeLessThan(8_000);
  });

  it("a panel range without answers keeps that range's Translation Questions (#17)", () => {
    const payload = buildStudyManualPayload(loadBundle(), {
      ref: parseObsTfReference("1:5-8")!,
      part: "movement1",
      includeAnswers: false,
    });
    const m1 = payload.movements[0];
    expect(m1.observation?.map((b) => b.frameId)).toEqual(["01-05", "01-06", "01-07", "01-08"]);
    expect(m1.translation?.map((b) => b.frameId)).toEqual(["01-05", "01-06", "01-07", "01-08"]);
    expect(formatStudyManualMd(payload)).not.toMatch(/\*\*A:\*\*/);
  });

  it("section picks one Movement 1 list and implies movement1", () => {
    const translation = buildStudyManualPayload(loadBundle(), {
      ref: parseObsTfReference("1:5")!,
      section: "translation",
    });
    expect(translation.part).toBe("movement1");
    expect(translation.movements).toHaveLength(1);
    expect(translation.movements[0].translation?.[0].frameId).toBe("01-05");
    expect(translation.movements[0].observation).toBeUndefined();

    const observation = buildStudyManualPayload(loadBundle(), {
      ref: parseObsTfReference("1")!,
      section: "observation",
    });
    expect(observation.movements[0].observation).toHaveLength(16);
    expect(observation.movements[0].translation).toBeUndefined();
    // section keeps answers unless includeAnswers is false
    expect(observation.movements[0].observation?.[0].items[0].answer).toBeTruthy();
  });

  it("does not repeat drafting and checking (#17)", () => {
    const ref = parseObsTfReference("1")!;
    const full = buildStudyManualPayload(loadBundle(), { ref });
    expect(full.movements.find((m) => m.id === 2)?.drafting).toBeTruthy();
    expect(full.drafting).toBeNull();
    expect(full.sections.drafting).toBe("movements[1]");
    expect(formatStudyManualMd(full)).toMatch(/Translation Draft/);

    const drafting = buildStudyManualPayload(loadBundle(), {
      ref,
      part: "drafting",
    });
    expect(drafting.movements).toHaveLength(0);
    expect(drafting.sections.drafting).toBe("drafting");
  });
});
