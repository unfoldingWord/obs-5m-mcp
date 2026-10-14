import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures", "en_obs_tf");

export function loadFixture(rel: string): string {
  return readFileSync(path.join(fixtureDir, rel), "utf8");
}

export interface CatalogStubEntry {
  language: string;
  language_title?: string;
  name: string;
  owner?: string;
  subject?: string;
}

/**
 * Stub global fetch for Door43 catalog (subject=OBS Theological Formation) + raw URLs.
 * Catalog returns owner/repo; fetches use those paths (no invented `{lang}_obs_tf`).
 */
export function stubDcsFetch(opts?: {
  /** Override English catalog repo name to prove we don't hardcode `_obs_tf`. */
  repoName?: string;
  /** Extra catalog rows (e.g. Indonesian `id_obs_tf` on DCS). */
  extraCatalog?: CatalogStubEntry[];
  /** Story markdown served from a repo path, keyed by repo name. Defaults to EN fixture. */
  storyMarkdownByRepo?: Record<string, string>;
}): void {
  const repoName = opts?.repoName ?? "en_obs_tf";
  const story1 = loadFixture("obs_story_1.md");
  const trans: Record<string, string> = {
    "movement_2_drafting.md": loadFixture("transclusions/movement_2_drafting.md"),
    "movement_3_checking.md": loadFixture("transclusions/movement_3_checking.md"),
    "movement_4.md": loadFixture("transclusions/movement_4.md"),
    "movement_5.md": loadFixture("transclusions/movement_5.md"),
    "conclusion.md": loadFixture("transclusions/conclusion.md"),
    "obs-devotionals-unit-3.md": loadFixture(
      "transclusions/obs-devotionals-unit-3.md",
    ),
  };
  const storyByRepo: Record<string, string> = {
    [repoName]: story1,
    ...opts?.storyMarkdownByRepo,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/search")) {
        // Mirror TH MCP: catalog must request topic=tc-ready + subject
        if (!url.includes("topic=tc-ready")) {
          return new Response("missing topic=tc-ready", { status: 400 });
        }
        if (!url.includes(encodeURIComponent("OBS Theological Formation")) &&
            !url.includes("OBS+Theological+Formation") &&
            !url.includes("subject=OBS")) {
          return new Response("missing subject", { status: 400 });
        }
        const params = new URL(url).searchParams;
        const lang = params.get("lang");
        const all = [
          {
            language: "en",
            language_title: "English",
            name: repoName,
            owner: "unfoldingWord",
            subject: "OBS Theological Formation",
          },
          ...(opts?.extraCatalog ?? []).map((e) => ({
            language: e.language,
            language_title: e.language_title ?? e.language,
            name: e.name,
            owner: e.owner ?? "unfoldingWord",
            subject: e.subject ?? "OBS Theological Formation",
          })),
        ];
        const data = lang
          ? all.filter((e) => e.language === lang.toLowerCase())
          : all;
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      for (const [repo, markdown] of Object.entries(storyByRepo)) {
        const repoPath = `/${repo}/`;
        if (!url.includes(repoPath)) continue;
        if (url.includes("obs_story_1.md")) {
          return new Response(markdown, { status: 200 });
        }
        if (url.includes("/transclusions/")) {
          const decoded = decodeURIComponent(url);
          const file = decoded.split("/transclusions/")[1] ?? "";
          const body = trans[file];
          if (body) return new Response(body, { status: 200 });
          return new Response("missing", { status: 404 });
        }
      }
      if (url.includes("obs_story_") || url.includes("/transclusions/")) {
        return new Response("not found", { status: 404 });
      }
      return new Response("unexpected " + url, { status: 500 });
    }),
  );
}

/**
 * On top of the current fetch stub, answer Door43 story fetches for the given
 * story numbers with HTTP 500, as during an outage. Other requests pass through.
 */
export function failStoryFetches(storyNums: number[]): void {
  const inner = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (storyNums.some((n) => url.includes(`obs_story_${n}.md`))) {
        return new Response("upstream error", { status: 500 });
      }
      return inner(input, init);
    }),
  );
}

export function restoreFetch(): void {
  vi.unstubAllGlobals();
}

/** Distinctive DCS Indonesian story so tests can tell it apart from local-md. */
export function indonesianDcsStoryMarkdown(): string {
  return loadFixture("obs_story_1.md").replace(
    "subtitle: The Creation",
    "subtitle: Penciptaan dari DCS",
  );
}

export function stubIndonesianDcsFetch(): void {
  stubDcsFetch({
    extraCatalog: [
      {
        language: "id",
        language_title: "Indonesian",
        name: "id_obs_tf",
        owner: "unfoldingWord",
      },
    ],
    storyMarkdownByRepo: {
      id_obs_tf: indonesianDcsStoryMarkdown(),
    },
  });
}

export function emptyEnv() {
  return {
    MCP_AGENT: {} as DurableObjectNamespace,
    OBS_5M_CACHE: undefined as unknown as KVNamespace,
    ASSETS_BUCKET: undefined as unknown as R2Bucket,
    PUBLIC_BASE_URL: "http://localhost:8790",
  };
}
