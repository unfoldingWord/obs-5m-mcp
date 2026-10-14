/**
 * Door43 / DCS fetcher for OBS Theological Formation resources.
 *
 * Discovery is subject-based (same pattern as translation-helps-mcp):
 *   subject=OBS Theological Formation + topic=tc-ready + stage=prod
 * Owner/repo come from catalog hits — never invent `{lang}_obs_tf`.
 */

import { ErrorCode, Obs5mError } from "../core/errors.js";
import { logger } from "../core/logger.js";
import { xrayPush } from "../core/xray/context.js";

const DCS_BASE = "https://git.door43.org";
const GITEA_API = `${DCS_BASE}/api/v1`;
const PREFERRED_OWNER = "unfoldingWord";
export const OBS_TF_SUBJECT = "OBS Theological Formation";
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

function storyRawUrl(owner: string, repo: string, storyNum: number): string {
  return `${DCS_BASE}/${owner}/${repo}/raw/branch/master/obs_story_${storyNum}.md`;
}

function transclusionRawUrl(owner: string, repo: string, file: string): string {
  const name = file.endsWith(".md") ? file : `${file}.md`;
  return `${DCS_BASE}/${owner}/${repo}/raw/branch/master/transclusions/${encodeURIComponent(name)}`;
}

/**
 * Prefer unfoldingWord among catalog hits (TH MCP pickPreferredCatalogEntry).
 */
export function pickPreferredObsTfEntry(
  entries: CatalogRepoRef[],
): CatalogRepoRef | undefined {
  if (entries.length === 0) return undefined;
  const uw = entries.find(
    (e) => e.owner.toLowerCase() === PREFERRED_OWNER.toLowerCase(),
  );
  return uw ?? entries[0];
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
 * Returns every matching catalog entry (may include multiple owners per language).
 */
export async function searchObsTfCatalog(
  env: DcsEnv,
  opts?: { language?: string },
): Promise<{ entries: CatalogRepoRef[]; cacheStatus: "hit" | "miss" }> {
  const lang = opts?.language?.toLowerCase();
  const key = `obs-tf:catalog:search:v2:${lang ?? "all"}`;
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
        "User-Agent": "obs-5m-mcp/0.2",
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
    for (const item of data.data ?? []) {
      const code = (item.language ?? "").toLowerCase();
      if (!code) continue;
      const ownerLogin =
        (typeof item.owner === "string" ? item.owner : item.owner?.login) ||
        item.repo?.owner?.login ||
        item.full_name?.split("/")[0];
      const repoName =
        item.name || item.repo?.name || item.full_name?.split("/")[1];
      // Subject search only — never invent `{lang}_obs_tf` when catalog omits names.
      if (!ownerLogin || !repoName) continue;
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
    // An unreachable catalog must not read as "no OBS-TF for this language":
    // callers would answer RESOURCE_NOT_AVAILABLE for content that exists.
    logger.warn("dcs:catalog_search_failed", { message: String(err), lang });
    throw new Obs5mError({
      code: ErrorCode.UPSTREAM_DCS_ERROR,
      message:
        `Door43 catalog search failed${lang ? ` for "${lang}"` : ""}: ` +
        (err instanceof Error ? err.message : String(err)),
      retryable: true,
    });
  }
}

/**
 * Resolve owner/repo for a language via subject catalog search.
 * Prefers unfoldingWord when multiple owners publish the same subject.
 */
export async function resolveObsTfRepo(
  language: string,
  env: DcsEnv,
): Promise<CatalogRepoRef | null> {
  return (await resolveObsTfRepoWithMeta(language, env)).ref;
}

/** What a catalog lookup cost, for the `_meta` budget a tool reports. */
export interface CatalogLookupMeta {
  /** One per catalog search that missed the cache and went to Door43. */
  downstreamApiCalls: number;
  /** "partial" when one search was cached and the other was not. */
  cacheStatus: "hit" | "miss" | "partial";
}

/**
 * resolveObsTfRepo plus what the lookup cost. A language missing from the
 * language-filtered search triggers a second, unfiltered search.
 */
export async function resolveObsTfRepoWithMeta(
  language: string,
  env: DcsEnv,
): Promise<{ ref: CatalogRepoRef | null } & CatalogLookupMeta> {
  const code = language.toLowerCase();
  const searches: Array<"hit" | "miss"> = [];
  const filtered = await searchObsTfCatalog(env, { language: code });
  searches.push(filtered.cacheStatus);
  let matches = filtered.entries.filter((e) => e.language === code);
  if (matches.length === 0) {
    const all = await searchObsTfCatalog(env);
    searches.push(all.cacheStatus);
    matches = all.entries.filter((e) => e.language === code);
  }
  const misses = searches.filter((s) => s === "miss").length;
  return {
    ref: pickPreferredObsTfEntry(matches) ?? null,
    downstreamApiCalls: misses,
    cacheStatus:
      misses === 0 ? "hit" : misses === searches.length ? "miss" : "partial",
  };
}

/** @deprecated Use resolveObsTfRepo — kept for callers that only need owner. */
export async function resolveObsTfOwner(
  language: string,
  env: DcsEnv,
): Promise<string> {
  const ref = await resolveObsTfRepo(language, env);
  return ref?.owner ?? PREFERRED_OWNER;
}

export async function fetchStoryMarkdown(
  language: string,
  storyNum: number,
  env: DcsEnv,
): Promise<{
  markdown: string;
  cacheStatus: "hit" | "miss";
  owner: string;
  repo: string;
}> {
  const ref = await resolveObsTfRepo(language, env);
  if (!ref) {
    throw new Obs5mError({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `No "${OBS_TF_SUBJECT}" (tc-ready) catalog entry for language "${language}".`,
    });
  }

  const { owner, repo } = ref;
  const key = `obs-tf:${owner}/${repo}:story:${storyNum}`;
  const cached = await kvGet(env.OBS_5M_CACHE, key);
  if (cached) {
    xrayPush({ type: "cache", key, hit: true });
    xrayPush({
      type: "dcs_fetch",
      url: storyRawUrl(owner, repo, storyNum),
      status: 200,
      ms: 0,
      cache: "hit",
      kind: "story",
    });
    return { markdown: cached, cacheStatus: "hit", owner, repo };
  }
  xrayPush({ type: "cache", key, hit: false });

  const url = storyRawUrl(owner, repo, storyNum);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Obs5mError({
      code: ErrorCode.UPSTREAM_DCS_ERROR,
      message:
        `Door43 fetch failed for ${url}: ` +
        (err instanceof Error ? err.message : String(err)),
      retryable: true,
    });
  }
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
      message: `OBS-TF story ${storyNum} not found for language "${language}" on DCS (${owner}/${repo}).`,
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
  return { markdown, cacheStatus: "miss", owner, repo };
}

export async function fetchTransclusionMarkdown(
  language: string,
  file: string,
  env: DcsEnv,
  repoRef?: { owner: string; repo: string },
): Promise<string | null> {
  const ref =
    repoRef ??
    (await resolveObsTfRepo(language, env)) ??
    undefined;
  if (!ref) return null;

  const { owner, repo } = ref;
  const key = `obs-tf:${owner}/${repo}:trans:${file}`;
  const cached = await kvGet(env.OBS_5M_CACHE, key);
  if (cached) {
    xrayPush({ type: "cache", key, hit: true });
    xrayPush({
      type: "dcs_fetch",
      url: transclusionRawUrl(owner, repo, file),
      status: 200,
      ms: 0,
      cache: "hit",
      kind: "transclusion",
    });
    return cached;
  }
  xrayPush({ type: "cache", key, hit: false });

  const url = transclusionRawUrl(owner, repo, file);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    // Same as an HTTP error for this transclusion: the story renders without
    // it, and the failure is logged rather than escaping as a raw error.
    logger.warn("dcs:transclusion_fetch_failed", {
      file,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
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
  repoRef?: { owner: string; repo: string },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(files)];
  const ref =
    repoRef ??
    (await resolveObsTfRepo(language, env)) ??
    undefined;
  if (!ref) return map;

  await Promise.all(
    unique.map(async (file) => {
      const md = await fetchTransclusionMarkdown(language, file, env, ref);
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
 * One preferred entry per language (unfoldingWord first).
 */
export async function listObsTfLanguages(
  env: DcsEnv,
): Promise<{ languages: CatalogLanguage[]; cacheStatus: "hit" | "miss" }> {
  const { entries, cacheStatus } = await searchObsTfCatalog(env);
  const byLang = new Map<string, CatalogRepoRef[]>();
  for (const e of entries) {
    const list = byLang.get(e.language) ?? [];
    list.push(e);
    byLang.set(e.language, list);
  }

  const languages: CatalogLanguage[] = [];
  for (const [, group] of byLang) {
    const pick = pickPreferredObsTfEntry(group);
    if (!pick) continue;
    languages.push({
      code: pick.language,
      name: pick.languageTitle,
      repo: pick.repo,
      owner: pick.owner,
    });
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
