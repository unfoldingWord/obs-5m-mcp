/**
 * Build fetch_obs_study_manual payloads (TH MCP issue #36).
 */

import type { StoryBundle } from "./contentService.js";
import {
  frameIdFor,
  frameIndexOf,
  frameInRef,
  type ObsTfReference,
} from "./obsTfReference.js";
import type { ObsTfMovement } from "./obsTfParser.js";

export type StudyManualFormat = "json" | "md" | "text";

/** Session slice for translator workflows (packaging-agnostic). */
export type StudyManualPart =
  | "full"
  | "intro"
  | "frames"
  | "community"
  | "movement1"
  | "movement2"
  | "movement3"
  | "movement4"
  | "movement5"
  | "drafting"
  | "checking"
  | "conclusion";

export const STUDY_MANUAL_PARTS = [
  "full",
  "intro",
  "frames",
  "community",
  "movement1",
  "movement2",
  "movement3",
  "movement4",
  "movement5",
  "drafting",
  "checking",
  "conclusion",
] as const satisfies readonly StudyManualPart[];

export interface StudyManualOptions {
  ref: ObsTfReference;
  /** When set, return only that movement (1–5). */
  movement?: number;
  /**
   * Fine-grained session part. Prefer this for agent routing.
   * When set with `movement`, `part` wins unless part is `full`.
   */
  part?: StudyManualPart;
  /**
   * When true (default), include Community Study / devotion.
   * Ignored when movement/part selects a single movement activity.
   */
  includeCommunityStudy?: boolean;
  /**
   * When false, leave out the manual's answers to the Observation Questions
   * (Movement 1) and the Discourse Questions (Movement 2); everything else is
   * returned as usual. Default true.
   */
  includeAnswers?: boolean;
  /** Return only one Movement 1 list: Observation or Translation Questions. */
  section?: StudyManualSection;
}

export const STUDY_MANUAL_SECTIONS = ["observation", "translation"] as const;
export type StudyManualSection = (typeof STUDY_MANUAL_SECTIONS)[number];

/** A movement as returned to clients: answers and markdown are optional. */
export interface StudyManualMovement
  extends Omit<ObsTfMovement, "markdown" | "observation" | "discourse"> {
  /** Raw manual text; only kept when the parsed lists do not cover the movement. */
  markdown?: string;
  observation?: Array<{
    frameId: string;
    items: Array<{ question: string; answer?: string }>;
  }>;
  discourse?: Array<{ question: string; answer?: string; frameRefs: string[] }>;
}

function frameIdInRef(frameId: string, ref: ObsTfReference): boolean {
  const index = frameIndexOf(frameId, ref.story);
  return index !== null && frameInRef(ref, index);
}

const FRAME_HEADING = /^(\d+)-(\d+)$/;
const DISCOURSE_REFS = /\(([\d\s,-]+)\)\s*$/;

/**
 * Drop the per-panel blocks of a movement's markdown that fall outside the
 * frame range (`#### 01-05` blocks and `##### Question? (01-01, 01-02)` blocks).
 * A block runs until the next heading of the same or a higher level.
 */
export function narrowMarkdownToRef(md: string, ref: ObsTfReference): string {
  if (ref.frame === null || ref.frame === 0) return md;
  const out: string[] = [];
  let skipLevel: number | null = null;
  for (const line of md.split("\n")) {
    const heading = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (skipLevel !== null && level <= skipLevel) skipLevel = null;
      if (skipLevel === null) {
        const text = heading[2];
        let drop = false;
        if (FRAME_HEADING.test(text)) {
          drop = !frameIdInRef(text, ref);
        } else {
          const refs = DISCOURSE_REFS.exec(text);
          if (refs) {
            const ids = refs[1].split(",").map((s) => s.trim());
            drop = ids.every((id) => !frameIdInRef(id, ref));
          }
        }
        if (drop) {
          skipLevel = level;
          continue;
        }
      }
    }
    if (skipLevel === null) out.push(line);
  }
  return out.join("\n");
}

function filterMovementForRef(
  m: ObsTfMovement,
  ref: ObsTfReference,
): ObsTfMovement {
  if (ref.frame === null || ref.frame === 0) return m;
  return {
    ...m,
    markdown: narrowMarkdownToRef(m.markdown, ref),
    observation: m.observation?.filter((b) => frameIdInRef(b.frameId, ref)),
    translation: m.translation?.filter((b) => frameIdInRef(b.frameId, ref)),
    discourse: m.discourse?.filter((d) =>
      d.frameRefs.some((fr) => frameIdInRef(fr, ref)),
    ),
  };
}

function hasParsedLists(m: {
  observation?: unknown[];
  translation?: unknown[];
  discourse?: unknown[];
  theological?: unknown[];
  journal?: unknown[];
  drafting?: string | null;
  checking?: string | null;
}): boolean {
  return (
    Boolean(m.observation?.length) ||
    Boolean(m.translation?.length) ||
    Boolean(m.discourse?.length) ||
    Boolean(m.theological?.length) ||
    Boolean(m.journal?.length) ||
    Boolean(m.drafting?.trim()) ||
    Boolean(m.checking?.trim())
  );
}

/**
 * Whether the raw markdown adds anything the parsed lists do not carry.
 * Movements 4–5 are mostly prose, so their markdown is the content.
 */
function needsMarkdown(m: ObsTfMovement): boolean {
  if (!m.markdown?.trim()) return false;
  if (!hasParsedLists(m)) return true;
  return (m.id === 4 || m.id === 5) && !m.drafting && !m.checking;
}

/**
 * Movements whose questions come with the manual's answers: Observation
 * Questions (1) and Discourse Questions (2). Everything else in the manual
 * is written for the whole group and has no answers to leave out.
 */
const HAS_ANSWERS = new Set([1, 2]);

function toClientMovement(
  m: ObsTfMovement,
  opts: { includeAnswers: boolean; section?: StudyManualSection },
): StudyManualMovement {
  const { markdown, observation, discourse, ...rest } = m;
  const out: StudyManualMovement = { ...rest };
  if (observation) {
    out.observation = opts.includeAnswers
      ? observation
      : observation.map((b) => ({
          frameId: b.frameId,
          items: b.items.map((i) => ({ question: i.question })),
        }));
  }
  if (discourse) {
    out.discourse = opts.includeAnswers
      ? discourse
      : discourse.map((d) => ({ question: d.question, frameRefs: d.frameRefs }));
  }
  if (opts.section) {
    // One Movement 1 list only.
    return {
      id: m.id,
      title: m.title,
      ...(opts.section === "observation"
        ? { observation: out.observation ?? [] }
        : { translation: m.translation ?? [] }),
    };
  }
  // Only Movements 1 and 2 carry answers, and their raw text holds them, so
  // without answers that text is never returned for them. If a language's
  // Movement 1 or 2 ever fails to parse into lists, it comes back empty here
  // rather than with its answers (all en and id stories parse today).
  if (needsMarkdown(m) && (opts.includeAnswers || !HAS_ANSWERS.has(m.id))) {
    out.markdown = markdown;
  }
  return out;
}

function movementPartId(id: number): StudyManualPart {
  return `movement${id}` as StudyManualPart;
}

function resolvePart(
  opts: StudyManualOptions,
): StudyManualPart {
  if (opts.part && opts.part !== "full") return opts.part;
  if (opts.movement !== undefined) return movementPartId(opts.movement);
  return opts.part ?? "full";
}

function draftingOf(movements: ObsTfMovement[]): string | null {
  return movements.find((m) => m.id === 2)?.drafting?.trim() || null;
}

function checkingOf(movements: ObsTfMovement[]): string | null {
  return movements.find((m) => m.id === 3)?.checking?.trim() || null;
}

export function buildStudyManualPayload(
  bundle: StoryBundle,
  opts: StudyManualOptions,
) {
  const { ref } = opts;
  const includeAnswers = opts.includeAnswers !== false;
  // A section is a Movement 1 list, so it implies movement1.
  const part =
    opts.section && (opts.part ?? "full") === "full" && opts.movement === undefined
      ? "movement1"
      : resolvePart(opts);
  // A section is one compact list: no story text, devotion or wrap-up around it.
  // Leaving out answers alone changes nothing else.
  const questionsOnly = opts.section !== undefined;
  const narrow =
    part !== "full" &&
    part !== "intro" &&
    part !== "frames" &&
    part !== "community";

  const includeCommunity =
    !questionsOnly &&
    opts.includeCommunityStudy !== false &&
    (part === "full" || part === "community");

  let movements = bundle.story.movements;
  if (part.startsWith("movement")) {
    const id = Number.parseInt(part.replace("movement", ""), 10);
    movements = movements.filter((m) => m.id === id);
  } else if (part === "drafting") {
    movements = movements.filter((m) => m.id === 2);
  } else if (part === "checking") {
    movements = movements.filter((m) => m.id === 3);
  } else if (part === "conclusion" || part === "intro" || part === "frames") {
    movements = [];
  } else if (part === "community") {
    movements = [];
  }

  if (opts.section) movements = movements.filter((m) => m.id === 1);

  movements = movements.map((m) => filterMovementForRef(m, ref));

  let frames = bundle.story.frames;
  if (ref.frame !== null && ref.frame > 0) {
    frames = frames.filter((f) => frameInRef(ref, f.index));
  }
  if (questionsOnly) frames = [];
  if (part !== "full" && part !== "frames" && part !== "intro") {
    // Keep frames only for full / frames / intro-adjacent whole-story views
    if (narrow || part === "community") frames = [];
  }
  if (part === "intro") frames = [];
  if (part === "frames") {
    // frames only
  }

  const intro =
    !questionsOnly && (part === "full" || part === "intro")
      ? ref.frame === null || ref.frame === 0 || part === "intro"
        ? bundle.story.intro
        : undefined
      : undefined;

  const communityStudy = includeCommunity ? bundle.communityStudy : null;
  const drafting = draftingOf(bundle.story.movements);
  const checking = checkingOf(bundle.story.movements);

  // Drafting/checking-only parts: the top-level drafting/checking field
  // carries the text, so no movement is repeated around it.
  if (part === "drafting" || part === "checking") movements = [];

  const clientMovements = movements.map((m) =>
    toClientMovement(m, { includeAnswers, section: opts.section }),
  );

  // Drafting and checking live inside movements 2 and 3 when those are
  // returned; the top-level fields carry them only otherwise.
  const inMovement = (id: number, key: "drafting" | "checking") =>
    clientMovements.some((m) => m.id === id && Boolean(m[key]?.trim()));
  const showConclusion =
    !questionsOnly && (part === "full" || part === "conclusion")
      ? bundle.story.conclusion
      : null;
  const showDrafting =
    (part === "full" || part === "drafting" || part === "movement2") &&
    !inMovement(2, "drafting")
      ? drafting
      : null;
  const showChecking =
    (part === "full" || part === "checking" || part === "movement3") &&
    !inMovement(3, "checking")
      ? checking
      : null;

  const at = (id: number): string | null => {
    const i = clientMovements.findIndex((m) => m.id === id);
    return i === -1 ? null : `movements[${i}]`;
  };
  const showFrames = part === "full" || part === "frames";
  const outFrames = part === "intro" || part === "community" ? [] : frames;

  return {
    resourceType: "obs-tf" as const,
    identifier: "obs-tf",
    title: "OBS + Theological Formation",
    reference: ref.canonical,
    language: bundle.language,
    story: ref.story,
    frame: ref.frame,
    frameEnd: ref.frameEnd,
    part,
    includeAnswers,
    section: opts.section ?? null,
    storyTitle: bundle.story.meta.subtitle,
    intro: part === "frames" || part === "community" ? undefined : intro,
    frames: outFrames,
    bibleSource:
      !questionsOnly && showFrames ? bundle.story.bibleSource : null,
    communityStudy,
    communityStudyRef: includeCommunity
      ? bundle.story.communityStudyRef
      : null,
    drafting: showDrafting,
    checking: showChecking,
    conclusion: showConclusion,
    movements: clientMovements,
    /**
     * Section map for BT Servant / agent routing: where each section sits in
     * this payload (a field name or "movements[i]"), or null when absent.
     * Content is not repeated here.
     */
    sections: {
      intro: intro ? "intro" : null,
      frames: showFrames && outFrames.length ? "frames" : null,
      communityStudy: communityStudy ? "communityStudy" : null,
      movement1_biblicalInterpretation: at(1),
      movement2_theologicalDialogue: at(2),
      movement3_personalReflection: at(3),
      movement4_ministryPractice: at(4),
      movement5_missionalOutreach: at(5),
      drafting: showDrafting ? "drafting" : inMovement(2, "drafting") ? at(2) : null,
      checking: showChecking ? "checking" : inMovement(3, "checking") ? at(3) : null,
      conclusion: showConclusion ? "conclusion" : null,
    },
    /** Suggested facilitator order for a full translation session */
    sessionFlow: [
      "intro",
      "frames",
      "community",
      "movement1",
      "movement2",
      "drafting",
      "movement3",
      "checking",
      "movement4",
      "movement5",
      "conclusion",
    ] as StudyManualPart[],
    source:
      bundle.sourceKind === "local-md"
        ? {
            kind: "local-md",
            note:
              "DCS has no OBS Theological Formation (tc-ready) for this language; content is shipped converted markdown in en_obs_tf shape. Shared and story-unique sections are resolved for you.",
            storyPath: `obs_story_${ref.story}.md`,
            license: "CC BY-SA 4.0",
          }
        : {
              kind: "dcs",
              owner: bundle.dcsRepo?.owner ?? "unfoldingWord",
              repo: bundle.dcsRepo?.repo ?? "unknown",
              storyPath: `obs_story_${ref.story}.md`,
              catalog: {
                subject: "OBS Theological Formation",
                topic: "tc-ready",
                stage: "prod",
              },
              transclusions: [
                "movement_2_drafting",
                "movement_3_checking",
                "movement_4",
                "movement_5",
                "conclusion",
                "obs-devotionals-unit-*",
              ],
              license: "CC BY-SA 4.0",
              door43: bundle.dcsRepo
                ? `https://git.door43.org/${bundle.dcsRepo.owner}/${bundle.dcsRepo.repo}`
                : undefined,
            },
  };
}

export type StudyManualPayload = ReturnType<typeof buildStudyManualPayload>;

function movementHeading(m: StudyManualMovement): string {
  return `## Movement ${m.id}: ${m.title}`;
}

function appendMovementStructured(lines: string[], m: StudyManualMovement): void {
  if (m.observation?.length) {
    lines.push("### Observation Questions");
    lines.push("");
    for (const block of m.observation) {
      lines.push(`#### ${block.frameId}`);
      lines.push("");
      for (const item of block.items) {
        lines.push(`- **Q:** ${item.question}`);
        if (item.answer) lines.push(`  - **A:** ${item.answer}`);
      }
      lines.push("");
    }
  }
  if (m.translation?.length) {
    lines.push("### Translation Questions");
    lines.push("");
    for (const block of m.translation) {
      lines.push(`#### ${block.frameId}`);
      lines.push("");
      for (const t of block.terms) {
        lines.push(`- **${t.term}:** ${t.guidance}`);
      }
      lines.push("");
    }
  }
  if (m.discourse?.length) {
    lines.push("### Discourse Questions");
    lines.push("");
    for (const d of m.discourse) {
      lines.push(`- **Q:** ${d.question}`);
      if (d.answer) lines.push(`  - **A:** ${d.answer}`);
    }
    lines.push("");
  }
  if (m.theological?.length) {
    lines.push("### Theological Questions");
    lines.push("");
    m.theological.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }
  if (m.drafting?.trim()) {
    lines.push("### Translation Draft");
    lines.push("");
    lines.push(m.drafting.trim());
    lines.push("");
  }
  if (m.journal?.length) {
    lines.push("### Journal Reflection");
    lines.push("");
    m.journal.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }
  if (m.checking?.trim()) {
    lines.push("### Team Check");
    lines.push("");
    lines.push(m.checking.trim());
    lines.push("");
  }
  const hasStructured = hasParsedLists(m);
  // Movements 4–5 (and sparse parts) rely on markdown body
  if (!hasStructured && m.markdown) {
    lines.push(m.markdown);
    lines.push("");
  } else if (
    hasStructured &&
    (m.id === 4 || m.id === 5) &&
    m.markdown &&
    !m.drafting &&
    !m.checking
  ) {
    lines.push(m.markdown);
    lines.push("");
  }
}

export function formatStudyManualMd(data: StudyManualPayload): string {
  const lines: string[] = [];
  lines.push(`# ${data.storyTitle} (OBS ${data.reference})`);
  lines.push("");
  if (data.part && data.part !== "full") {
    lines.push(`*Session part: ${data.part}*`);
    lines.push("");
  }
  if (data.intro) {
    lines.push("## Introduction");
    lines.push("");
    lines.push(`**Key Idea:** ${data.intro.keyIdea}`);
    lines.push("");
    lines.push(`**Creedal Verse:** ${data.intro.creedalVerse}`);
    lines.push("");
    lines.push(`**Metanarrative:** ${data.intro.metanarrative}`);
    lines.push("");
  }
  if (data.frames.length) {
    lines.push("## Story frames");
    lines.push("");
    for (const f of data.frames) {
      lines.push(`### ${f.id}`);
      lines.push("");
      lines.push(f.text);
      lines.push("");
    }
  }
  if (data.bibleSource) {
    lines.push(`*A Bible story from: ${data.bibleSource}*`);
    lines.push("");
  }
  if (data.communityStudy) {
    lines.push("## Community Study");
    lines.push("");
    lines.push(data.communityStudy);
    lines.push("");
  }
  for (const m of data.movements) {
    lines.push(movementHeading(m));
    lines.push("");
    appendMovementStructured(lines, m);
  }
  // Top-level drafting/checking when movements were stripped (part filter)
  if (
    data.drafting &&
    !data.movements.some((m) => m.id === 2 && m.drafting)
  ) {
    lines.push("## Translation Draft");
    lines.push("");
    lines.push(data.drafting);
    lines.push("");
  }
  if (
    data.checking &&
    !data.movements.some((m) => m.id === 3 && m.checking)
  ) {
    lines.push("## Team Check");
    lines.push("");
    lines.push(data.checking);
    lines.push("");
  }
  if (data.conclusion) {
    lines.push("## Conclusion");
    lines.push("");
    lines.push(data.conclusion);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function formatStudyManualText(data: StudyManualPayload): string {
  return formatStudyManualMd(data)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

/** Ensure formatters never return empty when JSON has content (#34 lesson). */
export function renderStudyManual(
  data: StudyManualPayload,
  format: StudyManualFormat,
): { format: StudyManualFormat; content: string | StudyManualPayload } {
  if (format === "json") {
    return { format, content: data };
  }
  const rendered =
    format === "md" ? formatStudyManualMd(data) : formatStudyManualText(data);
  if (!rendered.trim()) {
    return {
      format,
      content: JSON.stringify(data, null, 2),
    };
  }
  return { format, content: rendered };
}

export function frameLabel(story: number, frame: number): string {
  return frameIdFor(story, frame);
}
