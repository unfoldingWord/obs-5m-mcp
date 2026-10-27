import { describe, expect, it } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import { STUDY_MANUAL_PARTS } from "../../src/content/studyManual.js";
import { argsFromValues, fieldsFromSchema } from "../../web/src/lib/try/fields.js";
import { decodeTryState, encodeTryState, type TryState } from "../../web/src/lib/try/hashState.js";

const schema = zodToJsonSchema(fetchObsStudyManualTool.inputSchema) as Record<string, unknown>;

describe("fieldsFromSchema", () => {
  it("maps the study manual schema to form fields", () => {
    const fields = fieldsFromSchema(schema);
    const by = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(fields[0].key).toBe("reference");
    expect(by.reference).toMatchObject({ kind: "text", required: true });
    expect(by.part.kind).toBe("select");
    expect(by.part.options).toEqual([...STUDY_MANUAL_PARTS]);
    expect(by.movement).toMatchObject({ kind: "number", min: 1, max: 5, required: false });
    expect(by.format).toMatchObject({ kind: "select", default: "json" });
    expect(by.language).toMatchObject({ kind: "text", default: "en" });
  });

  it("drops empty optional values and casts numbers", () => {
    const fields = fieldsFromSchema(schema);
    expect(argsFromValues(fields, { reference: "1:5", movement: "2", part: "", language: undefined })).toEqual({
      reference: "1:5",
      movement: 2,
    });
  });
});

describe("try state in the URL hash", () => {
  it("round-trips", () => {
    const s: TryState = { tab: "tools", tool: "fetch_obs_study_manual", args: { reference: "1:5-8", note: "é" } };
    expect(decodeTryState(encodeTryState(s), ["fetch_obs_study_manual"])).toEqual(s);
    const g: TryState = { tab: "guided", lang: "en", story: 3, part: "movement1", view: "community" };
    expect(decodeTryState(encodeTryState(g), [])).toEqual(g);
  });

  it("falls back to the guided tab on anything odd", () => {
    expect(decodeTryState("#%%%", ["list_stories"])).toEqual({ tab: "guided" });
    expect(decodeTryState("#" + btoa('{"tab":"tools","tool":"rm"}'), ["list_stories"])).toEqual({ tab: "tools" });
    expect(decodeTryState("", [])).toEqual({ tab: "guided" });
    expect(decodeTryState("#" + btoa("[1,2]"), [])).toEqual({ tab: "guided" });
    expect(decodeTryState("#" + btoa('{"tab":"guided","story":"x","evil":1,"view":"admin"}'), [])).toEqual({ tab: "guided" });
  });
});
