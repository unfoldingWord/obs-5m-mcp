import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import { getFrameworkTool } from "../../src/mcp/tools/getFramework.js";
import { getPdfTool } from "../../src/mcp/tools/getPdf.js";
import { listResourcesTool } from "../../src/mcp/tools/listResources.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
  stubIndonesianDcsFetch,
} from "../helpers/mockDcsFetch.js";

describe("tool handlers (mocked DCS)", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
  });

  it("fetch_obs_study_manual returns study manual for 1:1", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1:1", language: "en", format: "json" },
      emptyEnv(),
      "test-1",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.resourceType).toBe("obs-tf");
    expect(sc.reference).toBe("1:1");
    expect(sc.storyTitle).toBe("The Creation");
    expect(Array.isArray(sc.movements)).toBe(true);
    expect((sc.movements as unknown[]).length).toBe(5);
  });

  it("fetch_obs_study_manual md format is non-empty", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "en", format: "md" },
      emptyEnv(),
      "test-2",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as { content?: string; format?: string };
    expect(sc.format).toBe("md");
    expect(typeof sc.content).toBe("string");
    expect((sc.content as string).length).toBeGreaterThan(100);
  });

  it("fetch_obs_study_manual movement filter works", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "en", movement: 4, format: "json" },
      emptyEnv(),
      "test-3",
    );
    const sc = result.structuredContent as {
      movements: Array<{ id: number; markdown: string }>;
      communityStudy: string | null;
    };
    expect(sc.movements).toHaveLength(1);
    expect(sc.movements[0].id).toBe(4);
    expect(sc.movements[0].markdown.length).toBeGreaterThan(20);
    expect(sc.communityStudy).toBeNull();
  });

  it("list_resources and get_framework work offline", async () => {
    const resources = await listResourcesTool.handler(
      { language: "en" },
      emptyEnv(),
      "t",
    );
    expect(resources.isError).toBe(false);
    const fw = await getFrameworkTool.handler({}, emptyEnv(), "t");
    expect(
      (fw.structuredContent as { movements: unknown[] }).movements,
    ).toHaveLength(5);
  });

  it("list_resources returns `available` rows like Translation Helps v2", async () => {
    const result = await listResourcesTool.handler(
      { language: "en" },
      emptyEnv(),
      "t",
    );
    const schema = z.object(listResourcesTool.outputSchema!);
    expect(schema.safeParse(result.structuredContent).success).toBe(true);

    // Consumers such as the BT Servant worker read the JSON text block and
    // take `abbreviation` + `subject` from each `available` row.
    const payload = JSON.parse(result.content.at(-1)!.text) as {
      available: Array<Record<string, unknown>>;
      resources: Array<Record<string, unknown>>;
    };
    expect(payload.available).toEqual([
      expect.objectContaining({
        abbreviation: "OBS-TF",
        subject: "OBS Theological Formation",
      }),
    ]);
    expect(payload.resources).toHaveLength(1);
  });

  it("list_resources returns an empty `available` for a language without OBS-TF", async () => {
    const result = await listResourcesTool.handler(
      { language: "xx" },
      emptyEnv(),
      "t",
    );
    expect(result.isError).toBe(false);
    const schema = z.object(listResourcesTool.outputSchema!);
    expect(schema.safeParse(result.structuredContent).success).toBe(true);
    const sc = result.structuredContent as {
      available: unknown[];
      resources: Array<{ available: boolean }>;
    };
    expect(sc.available).toEqual([]);
    // The per-row flag stays, so existing readers of `resources` keep working.
    expect(sc.resources).toHaveLength(1);
    expect(sc.resources[0]?.available).toBe(false);
  });

  it("get_pdf returns URL and extracted text for indonesian story 1", async () => {
    const result = await getPdfTool.handler(
      { story: 1, language: "id" },
      emptyEnv(),
      "t",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as {
      url?: string;
      r2Key?: string;
      text?: string;
      textAvailable?: boolean;
    };
    expect(sc.r2Key).toBe("id/obs-tf/01.pdf");
    expect(sc.url).toContain("/assets/pdf/");
    expect(sc.textAvailable).toBe(true);
    expect((sc.text ?? "").length).toBeGreaterThan(500);
  });

  it("fetch_obs_study_manual loads Indonesian from DCS when catalog has id", async () => {
    stubIndonesianDcsFetch();
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "id", format: "json" },
      emptyEnv(),
      "test-id-dcs",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as {
      source?: { kind?: string; owner?: string; repo?: string };
      storyTitle?: string;
      available?: boolean;
    };
    expect(sc.available).not.toBe(false);
    expect(sc.source?.kind).toBe("dcs");
    expect(sc.source?.owner).toBe("unfoldingWord");
    expect(sc.source?.repo).toBe("id_obs_tf");
    expect(sc.storyTitle).toBe("Penciptaan dari DCS");
  });

  it("fetch_obs_study_manual returns Indonesian local-md when DCS has no id entry", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "2", language: "id", format: "json" },
      emptyEnv(),
      "test-id",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as {
      source?: { kind?: string };
      available?: boolean;
      movements?: unknown[];
      frames?: unknown[];
    };
    expect(sc.available).not.toBe(false);
    expect(sc.source?.kind).toBe("local-md");
    expect((sc.movements ?? []).length).toBeGreaterThan(0);
    expect((sc.frames ?? []).length).toBe(12);
  });
});
