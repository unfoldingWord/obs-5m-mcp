import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  coerceStoryNumber,
  getFramework,
  getPdfInfo,
  listLanguages,
  listResourcesForLanguage,
  loadStoryBundle,
} from "../../src/content/contentService.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
  stubIndonesianDcsFetch,
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

  it("lists resources for en (DCS) and id (local-md, no PDF fallback)", async () => {
    const en = await listResourcesForLanguage("en", emptyEnv());
    expect(en.resources.some((r) => r.id === "obs-tf" && r.available)).toBe(
      true,
    );
    const enRow = en.resources.find((r) => r.id === "obs-tf");
    expect(enRow?.source).toBe("door43");
    expect(enRow?.owner).toBe("unfoldingWord");
    expect(enRow?.repo).toBe("en_obs_tf");
    expect(en.resources.some((r) => r.id === "obs-tf-pdf")).toBe(false);

    const id = await listResourcesForLanguage("id", emptyEnv());
    expect(id.resources.some((r) => r.id === "obs-tf-pdf")).toBe(false);
    const structured = id.resources.find((r) => r.id === "obs-tf");
    expect(structured?.available).toBe(true);
    expect(structured?.source).toBe("local-md");

    const none = await listResourcesForLanguage("xx", emptyEnv());
    expect(none.resources).toHaveLength(1);
    expect(none.resources[0]?.available).toBe(false);
    expect(none.resources[0]?.source).toBe("none");

    // `available` mirrors Translation Helps v2: only the rows that exist.
    expect(en.available.map((r) => r.id)).toEqual(["obs-tf"]);
    expect(id.available.map((r) => r.id)).toEqual(["obs-tf"]);
    expect(none.available).toEqual([]);

    const langs = await listLanguages(emptyEnv());
    expect(langs.languages.some((l) => l.code === "en" && l.sources.includes("dcs-obs-tf"))).toBe(
      true,
    );
    expect(langs.languages.some((l) => l.code === "id" && l.sources.includes("local-md"))).toBe(
      true,
    );
    expect(langs.languages.some((l) => l.sources.includes("self-hosted-pdf-text"))).toBe(
      false,
    );
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

  it("loads Indonesian from DCS when catalog has an id entry", async () => {
    stubIndonesianDcsFetch();

    const resources = await listResourcesForLanguage("id", emptyEnv());
    const row = resources.resources.find((r) => r.id === "obs-tf");
    expect(row?.available).toBe(true);
    expect(row?.source).toBe("door43");
    expect(row?.owner).toBe("unfoldingWord");
    expect(row?.repo).toBe("id_obs_tf");

    const langs = await listLanguages(emptyEnv());
    const idLang = langs.languages.find((l) => l.code === "id");
    expect(idLang?.sources).toContain("dcs-obs-tf");
    expect(idLang?.owner).toBe("unfoldingWord");
    expect(idLang?.repo).toBe("id_obs_tf");

    const bundle = await loadStoryBundle("id", 1, emptyEnv());
    expect(bundle.sourceKind).toBe("dcs");
    expect(bundle.dcsRepo).toEqual({
      owner: "unfoldingWord",
      repo: "id_obs_tf",
    });
    expect(bundle.story.meta.subtitle).toBe("Penciptaan dari DCS");
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
