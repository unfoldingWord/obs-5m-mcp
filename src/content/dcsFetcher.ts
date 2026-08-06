/**
 * Door43 / DCS fetcher for `{lang}_obs_tf` resources.
 * Catalog discovery mirrors translation-helps-mcp: always topic=tc-ready + stage=prod.
 */

import { ErrorCode, Obs5mError } from "../core/errors.js";
import { logger } from "../core/logger.js";
import { xrayPush } from "../core/xray/context.js";

const DCS_BASE = "https://git.door43.org";
const GITEA_API = `${DCS_BASE}/api/v1`;
const DEFAULT_ORG = "unfoldingWord";
const OBS_TF_SUBJECT = "OBS Theological Formation";
const STORY_TTL_SECONDS = 3600;
const CATALOG_TTL_SECONDS = 86400;

/** Always injected on catalog calls (same as TH MCP door43 client). */
const CATALOG_DEFAULTS: Record<string, string> = {
  topic: "tc-ready",
  stage: "prod",
};

export interface DcsEnv {
  OBS_5M_CACHE?: KVNamespace;
}

export interface CatalogLanguage {
  code: string;
  name: string;
  repo: string;
  owner: string;
}

export interface CatalogRepoRef {
  language: string;
  languageTitle: string;
  owner: string;
  repo: string;
  subject: string;
}

function buildCatalogUrl(
  endpoint: string,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams({ ...CATALOG_DEFAULTS });
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  return `${GITEA_API}/${endpoint}?${params.toString()}`;
}

function storyRawUrl(
  language: string,
  storyNum: number,
  owner = DEFAULT_ORG,
): string {
  return `${DCS_BASE}/${owner}/${language}_obs_tf/raw/branch/master/obs_story_${storyNum}.md`;
}

function transclusionRawUrl(
  language: string,
  file: string,
  owner = DEFAULT_ORG,
): string {
  const name = file.endsWith(".md") ? file : `${file}.md`;
  return `${DCS_BASE}/${owner}/${language}_obs_tf/raw/branch/master/transclusions/${encodeURIComponent(name)}`;
}

async function kvGet(kv: KVNamespace | undefined, key: string): Promise<string | null> {
  if (!kv) return null;
  try {
    return await kv.get(key);
  } catch {
    return null;
  }
}

async function kvPut(
  kv: KVNamespace | undefined,
  key: string,
  value: string,
  ttl: number,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, value, { expirationTtl: ttl });
  } catch (err) {
    logger.warn("kv:put_failed", { message: String(err) });
  }
}

/**
 * Search DCS catalog for OBS Theological Formation (tc-ready / prod).
 */
export async function searchObsTfCatalog(
  env: DcsEnv,
  opts?: { language?: string },
): Promise<{ entries: CatalogRepoRef[]; cacheStatus: "hit" | "miss" }> {
  const lang = opts?.language?.toLowerCase();
  const key = `obs-tf:catalog:search:${lang ?? "all"}`;
  const cached = await kvGet(env.OBS_5M_CACHE, key);
  if (cached) {
    xrayPush({ type: "cache", key, hit: true });
    return {
      entries: JSON.parse(cached) as CatalogRepoRef[],
      cacheStatus: "hit",
    };
  }
  xrayPush({ type: "cache", key, hit: false });

  const url = buildCatalogUrl("catalog/search", {
    subject: OBS_TF_SUBJECT,
    showIngredients: "true",
    limit: "100",
    lang,
  });

  try {
    const t0 = Date.now();
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "obs-5m-mcp/0.1",
      },
    });
    xrayPush({
      type: "dcs_fetch",
      url,
      status: res.status,
      ms: Date.now() - t0,
      cache: "miss",
      kind: "catalog",
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{
        language?: string;
        language_title?: string;
        owner?: string | { login?: string };
        name?: string;
        full_name?: string;
        subject?: string;
        repo?: { full_name?: string; name?: string; owner?: { login?: string } };
      }>;
    };

    const entries: CatalogRepoRef[] = [];
    const seen = new Set<string>();
    for (const item of data.data ?? []) {
      const code = (item.language ?? "").toLowerCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const ownerLogin =
        (typeof item.owner === "string" ? item.owner : item.owner?.login) ||
        item.repo?.owner?.login ||
        item.full_name?.split("/")[0] ||
        DEFAULT_ORG;
      const repoName =
        item.name ||
        item.repo?.name ||
        item.full_name?.split("/")[1] ||
        `${code}_obs_tf`;
      entries.push({
        language: code,
        languageTitle: item.language_title ?? code,
        owner: ownerLogin,
        repo: repoName,
        subject: item.subject ?? OBS_TF_SUBJECT,
      });
    }

    await kvPut(env.OBS_5M_CACHE, key, JSON.stringify(entries), CATALOG_TTL_SECONDS);
    return { entries, cacheStatus: "miss" };
  } catch (err) {
    logger.warn("dcs:catalog_search_failed", { message: String(err), lang });
    return { entries: [], cacheStatus: "miss" };
  }
}

/** Resolve owner for a language's obs_tf repo via catalog; falls back to unfoldingWord. */
export async function resolveObsTfOwner(
  language: string,
  env: DcsEnv,
): Promise<string> {
  const { entries } = await searchObsTfCatalog(env, { language });
  const hit = entries.find((e) => e.language === language.toLowerCase());
  return hit?.owner ?? DEFAULT_ORG;
}

/**
 * True when DCS catalog lists OBS Theological Formation for this language (tc-ready).
 */
export async function hasObsTfOnDcs(
  language: string,
  env: DcsEnv,
): Promise<boolean> {
  const { entries } = await searchObsTfCatalog(env, { language });
  if (entries.some((e) => e.language === language.toLowerCase())) return true;
  // Also accept broader catalog list (lang filter empty) for cache reuse
  const all = await searchObsTfCatalog(env);
  return all.entries.some((e) => e.language === language.toLowerCase());
}

export async function fetchStoryMarkdown(
  language: string,
  storyNum: number,
  env: DcsEnv,
): Promise<{ markdown: string; cacheStatus: "hit" | "miss"; owner: string }> {
  const owner = await resolveObsTfOwner(language, env);
  const key = `obs-tf:${language}:story:${storyNum}`;
  const cached = await kvGet(env.OBS_5M_CACHE, key);
  if (cached) {
    xrayPush({ type: "cache", key, hit: true });
    xrayPush({
      type: "dcs_fetch",
      url: storyRawUrl(language, storyNum, owner),
      status: 200,
      ms: 0,
      cache: "hit",
      kind: "story",
    });
    return { markdown: cached, cacheStatus: "hit", owner };
  }
  xrayPush({ type: "cache", key, hit: false });

  const url = storyRawUrl(language, storyNum, owner);
  const t0 = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - t0;
  xrayPush({
    type: "dcs_fetch",
    url,
    status: res.status,
    ms,
    cache: "miss",
    kind: "story",
  });
  if (res.status === 404) {
    throw new Obs5mError({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `OBS-TF story ${storyNum} not found for language "${language}" on DCS (${owner}/${language}_obs_tf).`,
    });
  }
  if (!res.ok) {
    throw new Obs5mError({
      code: ErrorCode.UPSTREAM_DCS_ERROR,
      message: `Door43 fetch failed (${res.status}) for ${url}`,
      retryable: true,
    });
  }
  const markdown = await res.text();
  await kvPut(env.OBS_5M_CACHE, key, markdown, STORY_TTL_SECONDS);
  return { markdown, cacheStatus: "miss", owner };
}

export async function fetchTransclusionMarkdown(
  language: string,
  file: string,
  env: DcsEnv,
  owner?: string,
): Promise<string | null> {
  const resolvedOwner = owner ?? (await resolveObsTfOwner(language, env));
  const key = `obs-tf:${language}:trans:${file}`;
  const cached = await kvGet(env.OBS_5M_CACHE, key);
  if (cached) {
    xrayPush({ type: "cache", key, hit: true });
    xrayPush({
      type: "dcs_fetch",
      url: transclusionRawUrl(language, file, resolvedOwner),
      status: 200,
      ms: 0,
      cache: "hit",
      kind: "transclusion",
    });
    return cached;
  }
  xrayPush({ type: "cache", key, hit: false });

  const url = transclusionRawUrl(language, file, resolvedOwner);
  const t0 = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - t0;
  xrayPush({
    type: "dcs_fetch",
    url,
    status: res.status,
    ms,
    cache: "miss",
    kind: "transclusion",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    logger.warn("dcs:transclusion_fetch_failed", {
      file,
      status: res.status,
    });
    return null;
  }
  const markdown = await res.text();
  await kvPut(env.OBS_5M_CACHE, key, markdown, STORY_TTL_SECONDS);
  return markdown;
}

export async function fetchTransclusionMap(
  language: string,
  files: string[],
  env: DcsEnv,
  owner?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(files)];
  const resolvedOwner = owner ?? (await resolveObsTfOwner(language, env));
  await Promise.all(
    unique.map(async (file) => {
      const md = await fetchTransclusionMarkdown(
        language,
        file,
        env,
        resolvedOwner,
      );
      if (md) {
        map.set(file, md);
        map.set(`${file}.md`, md);
      }
    }),
  );
  return map;
}

/**
 * Languages with a published OBS Theological Formation catalog entry (tc-ready).
 * Falls back to English when catalog is unreachable.
 */
export async function listObsTfLanguages(
  env: DcsEnv,
): Promise<{ languages: CatalogLanguage[]; cacheStatus: "hit" | "miss" }> {
  const { entries, cacheStatus } = await searchObsTfCatalog(env);
  const languages: CatalogLanguage[] = entries.map((e) => ({
    code: e.language,
    name: e.languageTitle,
    repo: e.repo,
    owner: e.owner,
  }));

  if (languages.length === 0) {
    return {
      languages: [
        {
          code: "en",
          name: "English",
          repo: "en_obs_tf",
          owner: DEFAULT_ORG,
        },
      ],
      cacheStatus,
    };
  }
  return { languages, cacheStatus };
}

/** Lightweight title probe: fetch story markdown and read subtitle frontmatter. */
export async function fetchStoryTitle(
  language: string,
  storyNum: number,
  env: DcsEnv,
): Promise<string | null> {
  try {
    const { markdown } = await fetchStoryMarkdown(language, storyNum, env);
    const m = /^subtitle:\s*(.+)$/m.exec(markdown);
    return m ? m[1].replace(/^['"]|['"]$/g, "").trim() : null;
  } catch {
    return null;
  }
}
