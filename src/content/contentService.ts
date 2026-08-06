/**
 * High-level content API for MCP tools.
 *
 * Resolution order per language/story:
 *   1. DCS catalog subject=OBS Theological Formation + topic=tc-ready → structured markdown
 *   2. Local converted MD (PDF → obs_tf) when DCS has nothing
 *   3. Coarse PDF plain-text fallback
 *   4. RESOURCE_NOT_FOUND / PDF URL via get_pdf
 */

import movementsData from "../../data/movements.json";
import collectionsData from "../../data/collections.json";
import storyTitlesEn from "../../data/story-titles-en.json";
import {
  fetchStoryMarkdown,
  fetchTransclusionMap,
  hasObsTfOnDcs,
  listObsTfLanguages,
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
  hasIndonesianPdfs,
  hasIndonesianText,
  listIndonesianStories,
  pdfPublicUrl,
} from "./indonesianStore.js";
import {
  getLocalStoryMarkdown,
  getLocalTransclusionMap,
  hasLocalObsTfStory,
} from "./localObsTfStore.js";
import { pdfTextToParsedStory } from "./pdfTextBundle.js";
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
  sourceKind: "dcs" | "local-md" | "pdf-text";
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

function loadPdfTextBundle(
  language: string,
  storyNum: number,
): StoryBundle | null {
  if (!(language === "id" || language.startsWith("id-"))) return null;
  const text = getIndonesianText(storyNum);
  if (!text) return null;
  const entry = getIndonesianStory(storyNum);
  const story = pdfTextToParsedStory(storyNum, text, entry?.title);
  return {
    language,
    story,
    communityStudy: story.intro.keyIdea || null,
    cacheStatus: "hit",
    downstreamApiCalls: 0,
    sourceKind: "pdf-text",
  };
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
  const { markdown, cacheStatus, owner } = await fetchStoryMarkdown(
    language,
    storyNum,
    env,
  );
  let downstreamApiCalls = cacheStatus === "hit" ? 0 : 1;

  let story = parseObsTfStoryMarkdown(markdown);
  const filesNeeded = [
    ...new Set(story.transclusionRefs.map((r) => r.file)),
  ];
  const fileMap = await fetchTransclusionMap(
    language,
    filesNeeded,
    env,
    owner,
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
  };
}

/**
 * Load study content: DCS OBS Theological Formation (tc-ready) first;
 * then local converted MD; then coarse PDF text.
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
    const isMissing =
      isObs5mError(err) && err.code === ErrorCode.RESOURCE_NOT_FOUND;
    if (!isMissing) throw err;

    const local = loadLocalMdBundle(language, storyNum);
    if (local) return local;

    const pdfBundle = loadPdfTextBundle(language, storyNum);
    if (pdfBundle) return pdfBundle;

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
  const out = languages.map((l) => ({
    code: l.code,
    name: l.name,
    sources: ["dcs-obs-tf"] as string[],
  }));

  if (hasIndonesianPdfs() && !out.some((l) => l.code === "id")) {
    const idm = getIndonesianManifest();
    out.push({
      code: idm.language,
      name: idm.languageName,
      sources: ["self-hosted-pdf-text"],
    });
  } else if (hasIndonesianPdfs()) {
    const row = out.find((l) => l.code === "id");
    if (row && !row.sources.includes("self-hosted-pdf-text")) {
      row.sources.push("self-hosted-pdf-text");
    }
  }

  if (!out.some((l) => l.code === "id")) {
    out.push({
      code: "id",
      name: "Indonesian",
      sources: ["self-hosted-pdf-text"],
    });
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
  const resources: Array<{
    id: string;
    type: string;
    available: boolean;
    source: string;
    description: string;
  }> = [];

  const isId = language === "id" || language.startsWith("id-");
  const onDcs = await hasObsTfOnDcs(language, env);
  const hasLocal = hasLocalObsTfStory(language, 1) || hasLocalObsTfStory(language, 2);

  resources.push({
    id: "obs-tf",
    type: "structured",
    available: onDcs || hasLocal || (isId && hasIndonesianText(1)),
    source: onDcs
      ? "door43"
      : hasLocal
        ? "local-md"
        : isId
          ? "self-hosted-pdf-text"
          : "none",
    description: onDcs
      ? `OBS + Theological Formation from DCS catalog (subject=OBS Theological Formation, topic=tc-ready)`
      : hasLocal
        ? "Converted OBS-TF markdown (PDF → en_obs_tf structure) — DCS has no entry for this language"
        : isId
          ? "Indonesian study text extracted from self-hosted PDFs (DCS has no id OBS TF yet)"
          : `No DCS OBS Theological Formation (tc-ready) for "${language}"`,
  });

  if (isId) {
    resources.push({
      id: "obs-tf-pdf",
      type: "pdf",
      available: hasIndonesianPdfs(),
      source: "self-hosted",
      description:
        "Self-hosted Indonesian OBS Five Movements PDFs (R2) — use when you need the file; text is also available via fetch_obs_study_manual",
    });
  }

  return { language, resources };
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

  const isId = language === "id" || language.startsWith("id-");
  const onDcs = await hasObsTfOnDcs(language, env);

  if (isId && !onDcs) {
    const idStories = listIndonesianStories();
    const byNum = new Map(idStories.map((s) => [s.story, s]));
    return {
      language,
      stories: storyNums.map((n) => {
        const entry = byNum.get(n);
        const col = collectionForStory(n);
        return {
          story: n,
          title: entry?.title ?? STORY_TITLE_FALLBACK[n] ?? `Story ${n}`,
          collection: col?.name ?? null,
          collectionId: col?.id ?? null,
          hasPdf: Boolean(entry),
          hasStructured: hasLocalObsTfStory(language, n) || hasIndonesianText(n),
        };
      }),
      downstreamApiCalls: 0,
      cacheStatus: "hit" as const,
    };
  }

  return {
    language,
    stories: storyNums.map((n) => {
      const col = collectionForStory(n);
      return {
        story: n,
        title: STORY_TITLE_FALLBACK[n] ?? `OBS Story ${n}`,
        collection: col?.name ?? null,
        collectionId: col?.id ?? null,
        hasPdf: false,
        hasStructured: onDcs,
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
      "Prefer fetch_obs_study_manual for study content. PDF URL is for download; text field carries extracted content when available.",
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
