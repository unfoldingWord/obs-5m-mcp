import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  coerceStoryNumber,
  getFramework,
  getPdfInfo,
  listResourcesForLanguage,
  loadStoryBundle,
} from "../../src/content/contentService.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
} from "../helpers/mockDcsFetch.js";

describe("contentService", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
  });

  it("coerces story numbers and titles", () => {
    expect(coerceStoryNumber(1)).toBe(1);
    expect(coerceStoryNumber("01")).toBe(1);
    expect(coerceStoryNumber("The Creation")).toBe(1);
  });

  it("returns five movements framework", () => {
    const fw = getFramework() as {
      movements: Array<{ name: string }>;
      overview?: { purpose?: string };
      formationPlan?: { dialogues?: unknown[] };
      source?: { formationStories?: string };
    };
    expect(fw.movements).toHaveLength(5);
    expect(fw.movements[0].name).toMatch(/Biblical Interpretation/);
    expect(fw.overview?.purpose).toMatch(/forms/i);
    expect(fw.formationPlan?.dialogues?.length).toBeGreaterThanOrEqual(3);
    expect(fw.source?.formationStories).toMatch(/formationstories\.org/);
  });

  it("lists resources for en (DCS) and id (local-md fallback)", async () => {
    const en = await listResourcesForLanguage("en", emptyEnv());
    expect(en.resources.some((r) => r.id === "obs-tf" && r.available)).toBe(
      true,
    );
    expect(en.resources.find((r) => r.id === "obs-tf")?.source).toBe("door43");

    const id = await listResourcesForLanguage("id", emptyEnv());
    expect(id.resources.some((r) => r.id === "obs-tf-pdf")).toBe(true);
    const structured = id.resources.find((r) => r.id === "obs-tf");
    expect(structured?.available).toBe(true);
    expect(structured?.source).toBe("local-md");
  });

  it("getPdfInfo returns Indonesian story URLs and extracted text", () => {
    const info = getPdfInfo("id", 2, {
      PUBLIC_BASE_URL: "http://localhost:8790",
    });
    expect(info).toMatchObject({
      story: 2,
      r2Key: "id/obs-tf/02.pdf",
      url: "http://localhost:8790/assets/pdf/id%2Fobs-tf%2F02.pdf",
      textAvailable: true,
    });
    expect(info?.text).toMatch(/Dosa Memasuki Dunia|Observasi/i);
    expect(getPdfInfo("en", 1, {})).toBeNull();
    expect(getPdfInfo("id", 50, {})).toBeNull();
  });

  it("loadStoryBundle falls back to local-md for Indonesian", async () => {
    const bundle = await loadStoryBundle("id", 2, emptyEnv());
    expect(bundle.sourceKind).toBe("local-md");
    expect(bundle.story.frames.length).toBe(12);
    expect(bundle.story.movements.length).toBeGreaterThan(0);
    expect(bundle.communityStudy).toBeTruthy();
    const m2 = bundle.story.movements.find((m) => m.id === 2);
    const m3 = bundle.story.movements.find((m) => m.id === 3);
    expect(m2?.drafting?.length).toBeGreaterThan(20);
    expect(m3?.checking?.length).toBeGreaterThan(20);
    expect(bundle.story.movements.find((m) => m.id === 4)?.markdown.length).toBeGreaterThan(
      20,
    );
    expect(bundle.story.conclusion?.length).toBeGreaterThan(20);
  });

  it("framework exposes sessionFlow for agent pacing", () => {
    const fw = getFramework() as {
      sessionFlow?: string[];
      framing?: { before?: { part?: string }; after?: { part?: string } };
    };
    expect(fw.sessionFlow).toContain("drafting");
    expect(fw.framing?.before?.part).toBe("community");
    expect(fw.framing?.after?.part).toBe("conclusion");
  });
});
