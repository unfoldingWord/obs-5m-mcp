import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures", "en_obs_tf");

export function loadFixture(rel: string): string {
  return readFileSync(path.join(fixtureDir, rel), "utf8");
}

/**
 * Stub global fetch for Door43 catalog (subject=OBS Theological Formation) + raw URLs.
 * Catalog returns owner/repo; fetches use those paths (no invented `{lang}_obs_tf`).
 */
export function stubDcsFetch(opts?: {
  /** Override catalog repo name to prove we don't hardcode `_obs_tf`. */
  repoName?: string;
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
        ];
        const data = lang
          ? all.filter((e) => e.language === lang.toLowerCase())
          : all;
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const repoPath = `/${repoName}/`;
      if (url.includes(repoPath) && url.includes("obs_story_1.md")) {
        return new Response(story1, { status: 200 });
      }
      if (url.includes(repoPath) && url.includes("/transclusions/")) {
        const decoded = decodeURIComponent(url);
        const file = decoded.split("/transclusions/")[1] ?? "";
        const body = trans[file];
        if (body) return new Response(body, { status: 200 });
        return new Response("missing", { status: 404 });
      }
      if (url.includes("obs_story_") || url.includes("/transclusions/")) {
        return new Response("not found", { status: 404 });
      }
      return new Response("unexpected " + url, { status: 500 });
    }),
  );
}

export function restoreFetch(): void {
  vi.unstubAllGlobals();
}

export function emptyEnv() {
  return {
    MCP_AGENT: {} as DurableObjectNamespace,
    OBS_5M_CACHE: undefined as unknown as KVNamespace,
    ASSETS_BUCKET: undefined as unknown as R2Bucket,
    PUBLIC_BASE_URL: "http://localhost:8790",
  };
}
