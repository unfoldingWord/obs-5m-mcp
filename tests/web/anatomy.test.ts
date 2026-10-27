import { describe, expect, it } from "vitest";
import { STUDY_MANUAL_PARTS } from "../../src/content/studyManual.js";
import { ANATOMY_PARTS } from "../../web/src/lib/anatomy/parts.js";
import { buildAnatomySnapshot } from "../../scripts/build-anatomy-snapshot.js";
import { loadStory1 } from "../fixtures/loadStory1.js";

describe("story anatomy", () => {
  it("lists the nine parts of a story in order", () => {
    expect(ANATOMY_PARTS.map((p) => p.part)).toEqual([
      "intro",
      "frames",
      "community",
      "movement1",
      "movement2",
      "movement3",
      "movement4",
      "movement5",
      "conclusion",
    ]);
    for (const p of ANATOMY_PARTS) {
      expect(STUDY_MANUAL_PARTS).toContain(p.part);
      expect(p.call.part).toBe(p.part);
    }
    const m1 = ANATOMY_PARTS.find((p) => p.part === "movement1")!;
    expect(m1.title).toBe("Biblical Interpretation: Observing the Details of the Story");
    expect(m1.call).toEqual({ reference: "1:5-8", part: "movement1", include_answers: false });
  });

  it("builds a saved excerpt for every part", () => {
    const snap = buildAnatomySnapshot(loadStory1());
    for (const p of ANATOMY_PARTS) {
      expect(snap[p.part]?.trim().length, p.part).toBeGreaterThan(20);
      expect(snap[p.part].length).toBeLessThanOrEqual(700);
    }
    expect(snap.movement1).toContain("01-05");
    expect(snap.movement1).not.toMatch(/\*\*A:\*\*/);
  });
});
