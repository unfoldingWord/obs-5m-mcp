import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchObsStudyManualTool } from "../../src/mcp/tools/fetchObsStudyManual.js";
import { getFrameworkTool } from "../../src/mcp/tools/getFramework.js";
import { getPdfTool } from "../../src/mcp/tools/getPdf.js";
import { getStoryTool } from "../../src/mcp/tools/getStory.js";
import { listLanguagesTool } from "../../src/mcp/tools/listLanguages.js";
import { listResourcesTool } from "../../src/mcp/tools/listResources.js";
import { listStoriesTool } from "../../src/mcp/tools/listStories.js";
import { searchContentTool } from "../../src/mcp/tools/searchContent.js";
import {
  emptyEnv,
  memoryKv,
  failCatalogFetches,
  failStoryFetches,
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

  it("fetch_obs_study_manual json text is the markdown, not a JSON copy (#17)", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "en", part: "movement1", format: "json" },
      emptyEnv(),
      "test-17-size",
    );
    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toMatch(/^# The Creation \(OBS 1\)/);
    expect(text).toMatch(/#### 01-01/);
    const total =
      JSON.stringify(result.content).length +
      JSON.stringify(result.structuredContent).length;
    expect(total).toBeLessThan(32_768);
  });

  it("fetch_obs_study_manual without answers keeps the rest of the part (#17)", async () => {
    const result = await fetchObsStudyManualTool.handler(
      {
        reference: "1:5-8",
        language: "en",
        part: "movement1",
        include_answers: false,
        format: "json",
      },
      emptyEnv(),
      "test-17-no-answers",
    );
    const text = result.content[0].text;
    expect(text).not.toMatch(/\*\*A:\*\*/);
    expect(text).toMatch(/Observation Questions/);
    expect(text).toMatch(/Translation Questions/);
  });

  it("fetch_obs_study_manual observation list without answers is small (#17)", async () => {
    const result = await fetchObsStudyManualTool.handler(
      {
        reference: "1:5-8",
        language: "en",
        section: "observation",
        include_answers: false,
        format: "json",
      },
      emptyEnv(),
      "test-17-questions",
    );
    const text = result.content[0].text;
    expect(text.match(/^#### /gm)).toHaveLength(4);
    expect(text).not.toMatch(/\*\*A:\*\*/);
    expect(text).not.toMatch(/Translation Questions/);
    expect(
      JSON.stringify(result.content).length +
        JSON.stringify(result.structuredContent).length,
    ).toBeLessThan(8_000);
  });

  it("fetch_obs_study_manual rejects section outside Movement 1", async () => {
    await expect(
      fetchObsStudyManualTool.handler(
        {
          reference: "1",
          language: "en",
          part: "movement2",
          section: "observation",
          format: "json",
        },
        emptyEnv(),
        "test-17-section",
      ),
    ).rejects.toThrow(/Movement 1 list/);
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
      movements: Array<{ id: number; markdown?: string }>;
      communityStudy: string | null;
    };
    expect(sc.movements).toHaveLength(1);
    expect(sc.movements[0].id).toBe(4);
    expect(sc.movements[0].markdown?.length).toBeGreaterThan(20);
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
    expect(result.content[0]?.text).toBe("1 resource(s) available for en");

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
    // The summary must not claim a resource the language does not have.
    expect(result.content[0]?.text).toBe("0 resource(s) available for xx");
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

// #7: a story that fails to load must not look like a story without matches.
describe("search_content when Door43 fails (mocked DCS)", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
  });

  const search = (maxStories: number) =>
    searchContentTool.handler(
      { query: "creation", language: "en", maxStories },
      emptyEnv(),
      "t",
    );

  it("still skips stories the language does not publish", async () => {
    // The stub serves story 1 only; story 2 is a 404, i.e. not published.
    const result = await search(2);
    const sc = result.structuredContent as { hits: unknown[]; failedStories?: number[] };
    expect(result.isError).toBe(false);
    expect(sc.hits.length).toBeGreaterThan(0);
    expect(sc.failedStories).toBeUndefined();
    expect(result.content[0]?.text).toBe(`${sc.hits.length} hit(s)`);
  });

  it("reports the stories it could not search", async () => {
    failStoryFetches([2]);
    const result = await search(2);
    const sc = result.structuredContent as { hits: unknown[]; failedStories?: number[] };
    expect(result.isError).toBe(false);
    expect(sc.hits.length).toBeGreaterThan(0);
    expect(sc.failedStories).toEqual([2]);
    expect(result.content[0]?.text).toMatch(/could not be searched/);
  });

  it("fails instead of returning 0 hits when no story could be loaded", async () => {
    failStoryFetches([1]);
    await expect(search(1)).rejects.toMatchObject({
      code: "UPSTREAM_DCS_ERROR",
      retryable: true,
    });
  });

  it("fails when the only published story fails and the rest are unpublished", async () => {
    // Story 1 fails; story 2 is a 404. Nothing was searched, so no "0 hits".
    failStoryFetches([1]);
    await expect(search(2)).rejects.toMatchObject({ code: "UPSTREAM_DCS_ERROR" });
  });

  it("reports a story whose fetch was rejected, not only HTTP errors", async () => {
    failStoryFetches([2], "network");
    const result = await search(2);
    const sc = result.structuredContent as { hits: unknown[]; failedStories?: number[] };
    expect(sc.hits.length).toBeGreaterThan(0);
    expect(sc.failedStories).toEqual([2]);
  });
});

// #10: an unreachable catalog must never read as "OBS-TF does not exist".
describe("tools when the Door43 catalog request fails (mocked DCS)", () => {
  beforeEach(() => {
    stubDcsFetch();
    failCatalogFetches();
  });
  afterEach(() => {
    restoreFetch();
  });

  const upstream = { code: "UPSTREAM_DCS_ERROR", retryable: true };

  it("story tools report an upstream error, not RESOURCE_NOT_AVAILABLE", async () => {
    await expect(
      getStoryTool.handler({ story: 1, language: "en" }, emptyEnv(), "t"),
    ).rejects.toMatchObject(upstream);
    await expect(
      fetchObsStudyManualTool.handler(
        { reference: "1:1", language: "en", format: "json" },
        emptyEnv(),
        "t",
      ),
    ).rejects.toMatchObject(upstream);
  });

  it("discovery tools report an upstream error instead of no OBS-TF", async () => {
    await expect(
      listResourcesTool.handler({ language: "en" }, emptyEnv(), "t"),
    ).rejects.toMatchObject(upstream);
    await expect(
      listStoriesTool.handler({ language: "en" }, emptyEnv(), "t"),
    ).rejects.toMatchObject(upstream);
    await expect(
      listLanguagesTool.handler({}, emptyEnv(), "t"),
    ).rejects.toMatchObject(upstream);
  });

  it("search_content fails instead of reporting 0 hits", async () => {
    await expect(
      searchContentTool.handler(
        { query: "creation", language: "en", maxStories: 2 },
        emptyEnv(),
        "t",
      ),
    ).rejects.toMatchObject(upstream);
  });

  it("treats a rejected catalog fetch like an HTTP error", async () => {
    restoreFetch();
    stubDcsFetch();
    failCatalogFetches("network");
    await expect(
      getStoryTool.handler({ story: 1, language: "en" }, emptyEnv(), "t"),
    ).rejects.toMatchObject(upstream);
  });

  it("still serves shipped local markdown for Indonesian", async () => {
    const result = await fetchObsStudyManualTool.handler(
      { reference: "2", language: "id", format: "json" },
      emptyEnv(),
      "t",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as { source?: { kind?: string } };
    expect(sc.source?.kind).toBe("local-md");
  });
});

describe("Door43 failures below the catalog (mocked DCS)", () => {
  afterEach(() => {
    restoreFetch();
  });

  it("serves Indonesian shipped markdown when the DCS story fetch fails", async () => {
    // Catalog lists id on DCS, but fetching story 2 there returns HTTP 500.
    stubIndonesianDcsFetch();
    failStoryFetches([2]);
    const result = await fetchObsStudyManualTool.handler(
      { reference: "2", language: "id", format: "json" },
      emptyEnv(),
      "t",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as { source?: { kind?: string } };
    expect(sc.source?.kind).toBe("local-md");
  });

  it("renders a story when a transclusion fetch is rejected by the network", async () => {
    stubDcsFetch();
    const inner = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/transclusions/")) {
          throw new TypeError("Network connection lost.");
        }
        return inner(input, init);
      }),
    );
    const result = await fetchObsStudyManualTool.handler(
      { reference: "1", language: "en", format: "json" },
      emptyEnv(),
      "t",
    );
    expect(result.isError).toBe(false);
    const sc = result.structuredContent as { storyTitle?: string };
    expect(sc.storyTitle).toBe("The Creation");
  });
});

// #8: `_meta` must count the catalog requests a call actually made.
describe("budget metadata for catalog lookups (mocked DCS)", () => {
  beforeEach(() => {
    stubDcsFetch();
  });
  afterEach(() => {
    restoreFetch();
  });

  const cachedEnv = () => ({ ...emptyEnv(), OBS_5M_CACHE: memoryKv() });
  const metaOf = (result: { structuredContent?: Record<string, unknown> }) =>
    result.structuredContent?._meta;

  it("list_resources counts the catalog search and reports the cache", async () => {
    const env = cachedEnv();
    const cold = await listResourcesTool.handler({ language: "en" }, env, "t");
    expect(metaOf(cold)).toEqual({ downstream_api_calls: 1, cache_status: "miss" });
    const warm = await listResourcesTool.handler({ language: "en" }, env, "t");
    expect(metaOf(warm)).toEqual({ downstream_api_calls: 0, cache_status: "hit" });
  });

  it("list_resources counts the second, unfiltered search for an unlisted language", async () => {
    const env = cachedEnv();
    // xx: filtered search (miss) finds nothing, so the full catalog is searched (miss).
    const first = await listResourcesTool.handler({ language: "xx" }, env, "t");
    expect(metaOf(first)).toEqual({ downstream_api_calls: 2, cache_status: "miss" });
    // yy: filtered search misses, the full catalog is now cached.
    const second = await listResourcesTool.handler({ language: "yy" }, env, "t");
    expect(metaOf(second)).toEqual({ downstream_api_calls: 1, cache_status: "partial" });
    // The X-ray / chat loop status keeps "partial" too.
    expect(second.cacheStatus).toBe("partial");
  });

  it("list_stories reports its catalog lookup in _meta only", async () => {
    const env = cachedEnv();
    const result = await listStoriesTool.handler({ language: "en" }, env, "t");
    expect(metaOf(result)).toEqual({ downstream_api_calls: 1, cache_status: "miss" });
    expect(result.structuredContent).not.toHaveProperty("cacheStatus");
    expect(result.structuredContent).not.toHaveProperty("downstreamApiCalls");
    const warm = await listStoriesTool.handler({ language: "en" }, env, "t");
    expect(metaOf(warm)).toEqual({ downstream_api_calls: 0, cache_status: "hit" });
  });

  it("search_content reports miss when every story missed the cache", async () => {
    const env = cachedEnv();
    const args = { query: "creation", language: "en", maxStories: 2 };
    const cold = await searchContentTool.handler(args, env, "t");
    expect(metaOf(cold)).toMatchObject({ cache_status: "miss" });
    const warm = await searchContentTool.handler(args, env, "t");
    expect(metaOf(warm)).toMatchObject({ cache_status: "hit" });
  });

  it("list_languages reports its catalog lookup in _meta only", async () => {
    const result = await listLanguagesTool.handler({}, cachedEnv(), "t");
    expect(metaOf(result)).toEqual({ downstream_api_calls: 1, cache_status: "miss" });
    expect(result.structuredContent).not.toHaveProperty("cacheStatus");
    expect(result.structuredContent).not.toHaveProperty("downstreamApiCalls");
  });
});
