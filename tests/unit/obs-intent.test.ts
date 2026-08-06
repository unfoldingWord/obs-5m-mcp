import { describe, expect, it } from "vitest";
import { detectObsIntent } from "../../src/chat/obsIntent.js";

describe("detectObsIntent", () => {
  it("detects framework questions", () => {
    expect(detectObsIntent("What are the Five Movements?").kind).toBe("framework");
    expect(detectObsIntent("How should we study OBS?").kind).toBe("framework");
  });

  it("detects explicit part=", () => {
    expect(detectObsIntent("Open part=movement1 for this story")).toEqual({
      kind: "part",
      part: "movement1",
    });
  });

  it("detects community / drafting / checking aliases", () => {
    expect(detectObsIntent("Lead community study for story 2")).toEqual({
      kind: "part",
      part: "community",
    });
    expect(detectObsIntent("Open translation drafting")).toEqual({
      kind: "part",
      part: "drafting",
    });
    expect(detectObsIntent("Open team checking questions")).toEqual({
      kind: "part",
      part: "checking",
    });
  });

  it("detects story switches", () => {
    expect(detectObsIntent("Open story 12")).toEqual({ kind: "story", story: 12 });
    expect(detectObsIntent("OBS 3 please")).toEqual({ kind: "story", story: 3 });
  });

  it("detects explicit mode switches only", () => {
    expect(detectObsIntent("Switch to translate mode")).toEqual({
      kind: "mode",
      mode: "translate",
    });
    expect(detectObsIntent("Lead observation for this story").kind).not.toBe("mode");
  });

  it("detects leader vs member role", () => {
    expect(detectObsIntent("I am the group leader / trainer. Help me facilitate.")).toEqual({
      kind: "role",
      role: "leader",
    });
    expect(detectObsIntent("I am joining as a group member. Help me participate.")).toEqual({
      kind: "role",
      role: "member",
    });
  });

  it("detects whole-lesson compile requests", () => {
    expect(detectObsIntent("Show me the full formatted lesson").kind).toBe("lesson");
    expect(detectObsIntent("Compile the whole study manual for this story").kind).toBe(
      "lesson",
    );
  });
});
