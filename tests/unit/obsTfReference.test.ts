import { describe, expect, it } from "vitest";
import {
  frameIdFor,
  frameInRef,
  frameIndexOf,
  matchesFrameId,
  parseObsTfReference,
} from "../../src/content/obsTfReference.js";

describe("parseObsTfReference", () => {
  it("parses whole story and story:frame", () => {
    expect(parseObsTfReference("1")).toEqual({
      story: 1,
      frame: null,
      frameEnd: null,
      canonical: "1",
    });
    expect(parseObsTfReference("1:1")).toEqual({
      story: 1,
      frame: 1,
      frameEnd: null,
      canonical: "1:1",
    });
    expect(parseObsTfReference("obs 2:3")).toEqual({
      story: 2,
      frame: 3,
      frameEnd: null,
      canonical: "2:3",
    });
  });

  it("parses frame ranges", () => {
    expect(parseObsTfReference("1:5-8")).toEqual({
      story: 1,
      frame: 5,
      frameEnd: 8,
      canonical: "1:5-8",
    });
    expect(parseObsTfReference("1:5-5")?.canonical).toBe("1:5");
    expect(parseObsTfReference("1:8-5")).toBeNull();
  });

  it("rejects front and invalid", () => {
    expect(parseObsTfReference("front")).toBeNull();
    expect(parseObsTfReference("GEN 1:1")).toBeNull();
    expect(parseObsTfReference("")).toBeNull();
  });

  it("matches frame ids", () => {
    expect(frameIdFor(1, 1)).toBe("01-01");
    expect(matchesFrameId("01-01", 1, 1)).toBe(true);
    expect(matchesFrameId("01-02", 1, 1)).toBe(false);
    expect(frameIndexOf("01-05", 1)).toBe(5);
    expect(frameIndexOf("1-5", 1)).toBe(5);
    expect(frameIndexOf("02-05", 1)).toBeNull();
  });

  it("checks frames against a range", () => {
    const range = parseObsTfReference("1:5-8")!;
    expect([4, 5, 8, 9].map((f) => frameInRef(range, f))).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(frameInRef(parseObsTfReference("1")!, 12)).toBe(true);
  });
});
