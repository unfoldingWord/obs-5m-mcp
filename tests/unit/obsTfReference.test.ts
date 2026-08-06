import { describe, expect, it } from "vitest";
import {
  frameIdFor,
  matchesFrameId,
  parseObsTfReference,
} from "../../src/content/obsTfReference.js";

describe("parseObsTfReference", () => {
  it("parses whole story and story:frame", () => {
    expect(parseObsTfReference("1")).toEqual({
      story: 1,
      frame: null,
      canonical: "1",
    });
    expect(parseObsTfReference("1:1")).toEqual({
      story: 1,
      frame: 1,
      canonical: "1:1",
    });
    expect(parseObsTfReference("obs 2:3")).toEqual({
      story: 2,
      frame: 3,
      canonical: "2:3",
    });
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
  });
});
