import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStoryMarkdown,
  pickPreferredObsTfEntry,
  resolveObsTfRepo,
  type CatalogRepoRef,
} from "../../src/content/dcsFetcher.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
  stubIndonesianDcsFetch,
} from "../helpers/mockDcsFetch.js";

describe("dcsFetcher subject resolution", () => {
  afterEach(() => restoreFetch());

  it("resolves owner/repo from catalog subject, not invented _obs_tf", async () => {
    stubDcsFetch({ repoName: "custom-obs-theological-formation" });
    const ref = await resolveObsTfRepo("en", emptyEnv());
    expect(ref).toEqual(
      expect.objectContaining({
        owner: "unfoldingWord",
        repo: "custom-obs-theological-formation",
        language: "en",
      }),
    );
    const { markdown, owner, repo } = await fetchStoryMarkdown(
      "en",
      1,
      emptyEnv(),
    );
    expect(owner).toBe("unfoldingWord");
    expect(repo).toBe("custom-obs-theological-formation");
    expect(markdown).toMatch(/title:/);
  });

  it("resolves Indonesian from DCS catalog subject search", async () => {
    stubIndonesianDcsFetch();
    const ref = await resolveObsTfRepo("id", emptyEnv());
    expect(ref).toEqual(
      expect.objectContaining({
        language: "id",
        owner: "unfoldingWord",
        repo: "id_obs_tf",
        subject: "OBS Theological Formation",
      }),
    );
    const { markdown, owner, repo } = await fetchStoryMarkdown(
      "id",
      1,
      emptyEnv(),
    );
    expect(owner).toBe("unfoldingWord");
    expect(repo).toBe("id_obs_tf");
    expect(markdown).toMatch(/Penciptaan dari DCS/);
  });

  it("returns null when catalog has no subject hit for language", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/catalog/search")) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("should not invent raw url", { status: 500 });
      }),
    );
    expect(await resolveObsTfRepo("xx", emptyEnv())).toBeNull();
  });

  it("pickPreferredObsTfEntry prefers unfoldingWord", () => {
    const entries: CatalogRepoRef[] = [
      {
        language: "en",
        languageTitle: "English",
        owner: "otherOrg",
        repo: "en_obs_tf_fork",
        subject: "OBS Theological Formation",
      },
      {
        language: "en",
        languageTitle: "English",
        owner: "unfoldingWord",
        repo: "en_obs_tf",
        subject: "OBS Theological Formation",
      },
    ];
    expect(pickPreferredObsTfEntry(entries)?.owner).toBe("unfoldingWord");
    expect(pickPreferredObsTfEntry(entries)?.repo).toBe("en_obs_tf");
  });
});
