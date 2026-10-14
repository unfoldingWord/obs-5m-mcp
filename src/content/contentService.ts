/**
 * High-level content API for MCP tools.
 *
 * Resolution order per language/story:
 *   1. DCS catalog subject=OBS Theological Formation + topic=tc-ready → structured markdown
 *   2. Local converted MD when DCS has nothing, or when DCS cannot be reached
 *   3. RESOURCE_NOT_FOUND when DCS has nothing, UPSTREAM_DCS_ERROR when it
 *      could not be reached (get_pdf is download-only; not a study-text fallback)
 */

import { logger } from "../core/logger.js";
import movementsData from "../../data/movements.json";
import collectionsData from "../../data/collections.json";
import storyTitlesEn from "../../data/story-titles-en.json";
import {
  fetchStoryMarkdown,
  fetchTransclusionMap,
  hasObsTfOnDcs,
  listObsTfLanguages,
  resolveObsTfRepo,
  type DcsEnv,
} from "./dcsFetcher.js";
import {
  applyTransclusionsToStory,
  parseObsTfStoryMarkdown,
  resolveTransclusion,
  type ObsTfMovement,
  type ParsedObsTfStory,
} from "./obsTfParser.js";
import {
  getIndonesianManifest,
  getIndonesianStory,
  getIndonesianText,
  pdfPublicUrl,
} from "./indonesianStore.js";
import {
  getLocalStoryMarkdown,
  getLocalTransclusionMap,
  hasLocalObsTfStory,
  listLocalObsTfLanguages,
} from "./localObsTfStore.js";
import { ErrorCode, isObs5mError, Obs5mError } from "../core/errors.js";

export interface ContentEnv extends DcsEnv {
  ASSETS_BUCKET?: R2Bucket;
  PUBLIC_BASE_URL?: string;
}

export interface StoryBundle {
  language: string;
  story: ParsedObsTfStory;
  communityStudy: string | null;
  cacheStatus: "hit" | "miss";
  downstreamApiCalls: number;
  /** Where structured content came from */
  sourceKind: "dcs" | "local-md";
  /** Catalog owner/repo when sourceKind is dcs (subject search). */
  dcsRepo?: { owner: string; repo: string };
}

const STORY_TITLE_FALLBACK: Record<number, string> = Object.fromEntries(
  Object.entries(storyTitlesEn as Record<string, string>).map(([k, v]) => [
    Number(k),
    v,
  ]),
) as Record<number, string>;

export function coerceStoryNumber(input: string | number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.trunc(input);
  }
  const s = String(input).trim();
  if (/^\d{1,2}$/.test(s)) return Number.parseInt(s, 10);
  const padded = /^0*(\d{1,2})$/.exec(s);
  if (padded) return Number.parseInt(padded[1], 10);
  const lower = s.toLowerCase();
  for (const [num, title] of Object.entries(STORY_TITLE_FALLBACK)) {
    if (title.toLowerCase() === lower) return Number(num);
  }
  throw new Obs5mError({
    code: ErrorCode.INVALID_PARAMS,
    message: `Invalid story identifier: "${input}". Use 1–50 or a known title.`,
  });
}

export function assertStoryRange(story: number): void {
  if (story < 1 || story > 50) {
    throw new Obs5mError({
      code: ErrorCode.INVALID_PARAMS,
      message: `Story must be between 1 and 50 (got ${story}).`,
    });
  }
}

export function getFramework() {
  return movementsData;
}

export function getCollections() {
  return collectionsData.collections;
}

export function collectionForStory(story: number) {
  return getCollections().find((c) => c.stories.includes(story)) ?? null;
}

function loadLocalMdBundle(
  language: string,
  storyNum: number,
): StoryBundle | null {
  const markdown = getLocalStoryMarkdown(language, storyNum);
  if (!markdown) return null;
  let story = parseObsTfStoryMarkdown(markdown);
  const fileMap = getLocalTransclusionMap(language);
  story = applyTransclusionsToStory(story, fileMap);

  let communityStudy: string | null = null;
  if (story.communityStudyRef) {
    communityStudy = resolveTransclusion(story.communityStudyRef, fileMap);
  }
  if (!communityStudy && story.inlineCommunityStudy) {
    communityStudy = story.inlineCommunityStudy;
  }

  return {
    language,
    story,
    communityStudy,
    cacheStatus: "hit",
    downstreamApiCalls: 0,
    sourceKind: "local-md",
  };
}

async function loadDcsBundle(
  language: string,
  storyNum: number,
  env: ContentEnv,
): Promise<StoryBundle> {
  const { markdown, cacheStatus, owner, repo } = await fetchStoryMarkdown(
    language,
    storyNum,
    env,
  );
  let downstreamApiCalls = cacheStatus === "hit" ? 0 : 1;
  const dcsRepo = { owner, repo };

  let story = parseObsTfStoryMarkdown(markdown);
  const filesNeeded = [
    ...new Set(story.transclusionRefs.map((r) => r.file)),
  ];
  const fileMap = await fetchTransclusionMap(
    language,
    filesNeeded,
    env,
    dcsRepo,
  );
  downstreamApiCalls += filesNeeded.length;

  story = applyTransclusionsToStory(story, fileMap);

  let communityStudy: string | null = null;
  if (story.communityStudyRef) {
    communityStudy = resolveTransclusion(story.communityStudyRef, fileMap);
  }
  if (!communityStudy && story.inlineCommunityStudy) {
    communityStudy = story.inlineCommunityStudy;
  }

  return {
    language,
    story,
    communityStudy,
    cacheStatus,
    downstreamApiCalls,
    sourceKind: "dcs",
    dcsRepo,
  };
}

/**
 * Load study content: DCS OBS Theological Formation (tc-ready) first;
 * then local converted MD. No PDF-text fallback.
 */
export async function loadStoryBundle(
  language: string,
  storyNum: number,
  env: ContentEnv,
): Promise<StoryBundle> {
  assertStoryRange(storyNum);

  try {
    return await loadDcsBundle(language, storyNum, env);
  } catch (err) {
    // Not published on DCS, or DCS unreachable: serve shipped markdown when
    // the language has it, so an outage does not take local content down.
    const isMissing =
      isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND;
    const isUpstream =
      isObs5mError(err) && err.code === ErrorCode.UPSTREAM_DCS_ERROR;
    if (!isMissing && !isUpstream) throw err;

    const local = loadLocalMdBundle(language, storyNum);
    if (local) {
      if (isUpstream) {
        logger.warn("content:dcs_unavailable_serving_local", {
          language,
          story: storyNum,
          message: err.message,
        });
      }
      return local;
    }

    throw err;
  }
}

export function movementFromBundle(
  bundle: StoryBundle,
  movement: number,
): ObsTfMovement {
  if (movement < 1 || movement > 5) {
    throw new Obs5mError({
      code: ErrorCode.INVALID_PARAMS,
      message: `Movement must be 1–5 (got ${movement}).`,
    });
  }
  const m = bundle.story.movements.find((x) => x.id === movement);
  if (!m) {
    throw new Obs5mError({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `Movement ${movement} not found in story ${bundle.story.meta.storyNum}.`,
    });
  }
  return m;
}

export async function listLanguages(env: ContentEnv) {
  const { languages, cacheStatus } = await listObsTfLanguages(env);
  const out: Array<{
    code: string;
    name: string;
    sources: string[];
    owner?: string;
    repo?: string;
  }> = languages.map((l) => ({
    code: l.code,
    name: l.name,
    sources: ["dcs-obs-tf"],
    owner: l.owner,
    repo: l.repo,
  }));

  for (const local of listLocalObsTfLanguages()) {
    const existing = out.find((l) => l.code === local.code);
    if (existing) {
      if (!existing.sources.includes("local-md")) existing.sources.push("local-md");
    } else {
      out.push({
        code: local.code,
        name: local.name,
        sources: ["local-md"],
      });
    }
  }

  return {
    languages: out,
    cacheStatus,
    downstreamApiCalls: cacheStatus === "hit" ? 0 : 1,
  };
}

export async function listResourcesForLanguage(
  language: string,
  env: ContentEnv,
) {
  const ref = await resolveObsTfRepo(language, env);
  const hasLocal =
    hasLocalObsTfStory(language, 1) || hasLocalObsTfStory(language, 2);
  const available = Boolean(ref) || hasLocal;
  const source = ref ? "door43" : hasLocal ? "local-md" : "none";

  const resources = [
    {
      id: "obs-tf",
      type: "structured",
      abbreviation: "OBS-TF",
      subject: "OBS Theological Formation",
      available,
      source,
      ...(ref ? { owner: ref.owner, repo: ref.repo } : {}),
      description: ref
        ? `OBS + Theological Formation from DCS (${ref.owner}/${ref.repo}, subject=OBS Theological Formation, topic=tc-ready)`
        : hasLocal
          ? "Converted OBS-TF markdown (en_obs_tf structure) — DCS has no catalog entry for this language"
          : `No OBS Theological Formation (tc-ready) for "${language}"`,
    },
  ];

  return {
    language,
    // Same contract as Translation Helps v2 `list_resources`: `available` holds
    // only the rows that exist for the language. Consumers that pick a parser
    // from the tool name (BT Servant Resources panel) read this array.
    available: resources.filter((r) => r.available),
    resources,
  };
}

export async function listStories(
  language: string,
  env: ContentEnv,
  collectionId?: number,
) {
  let storyNums = Array.from({ length: 50 }, (_, i) => i + 1);
  if (collectionId !== undefined) {
    const col = getCollections().find((c) => c.id === collectionId);
    if (!col) {
      throw new Obs5mError({
        code: ErrorCode.INVALID_PARAMS,
        message: `Unknown collection id ${collectionId}`,
      });
    }
    storyNums = [...col.stories];
  }

  const onDcs = await hasObsTfOnDcs(language, env);

  return {
    language,
    stories: storyNums.map((n) => {
      const col = collectionForStory(n);
      return {
        story: n,
        title: STORY_TITLE_FALLBACK[n] ?? `OBS Story ${n}`,
        collection: col?.name ?? null,
        collectionId: col?.id ?? null,
        hasStructured: onDcs || hasLocalObsTfStory(language, n),
      };
    }),
    downstreamApiCalls: 0,
    cacheStatus: "hit" as const,
  };
}

export function getPdfInfo(
  language: string,
  storyNum: number,
  env: ContentEnv,
) {
  assertStoryRange(storyNum);
  if (!(language === "id" || language.startsWith("id-"))) {
    return null;
  }
  const entry = getIndonesianStory(storyNum);
  if (!entry) return null;
  const base = env.PUBLIC_BASE_URL ?? "http://localhost:8790";
  const text = getIndonesianText(storyNum);
  return {
    language,
    story: storyNum,
    title: entry.title,
    r2Key: entry.r2Key,
    url: pdfPublicUrl(entry, base),
    text: text ?? undefined,
    textAvailable: Boolean(text),
    license: getIndonesianManifest().license,
    note:
      "Download-only. Prefer fetch_obs_study_manual / list_resources for study content — PDF text is not a fallback source.",
  };
}

/** Lexical search over a loaded story's key fields (caller iterates stories). */
export function searchInStory(
  story: ParsedObsTfStory,
  query: string,
): Array<{ field: string; snippet: string }> {
  const q = query.toLowerCase();
  const hits: Array<{ field: string; snippet: string }> = [];
  const push = (field: string, text: string) => {
    if (text.toLowerCase().includes(q)) {
      const idx = text.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      const snippet = text.slice(start, start + 120).replace(/\s+/g, " ");
      hits.push({ field, snippet });
    }
  };
  push("subtitle", story.meta.subtitle);
  push("keyIdea", story.intro.keyIdea);
  push("creedalVerse", story.intro.creedalVerse);
  push("raw", story.rawMarkdown);
  for (const f of story.frames) push(`frame:${f.id}`, f.text);
  if (story.conclusion) push("conclusion", story.conclusion);
  if (story.inlineCommunityStudy) {
    push("communityStudy", story.inlineCommunityStudy);
  }
  for (const m of story.movements) {
    push(`movement:${m.id}`, m.markdown);
    if (m.drafting) push("drafting", m.drafting);
    if (m.checking) push("checking", m.checking);
    for (const o of m.observation ?? []) {
      for (const item of o.items) {
        push(`observation:${o.frameId}`, `${item.question} ${item.answer}`);
      }
    }
  }
  return hits;
}
