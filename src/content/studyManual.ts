/**
 * Build fetch_obs_study_manual payloads (TH MCP issue #36).
 */

import type { StoryBundle } from "./contentService.js";
import {
  frameIdFor,
  matchesFrameId,
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
}

function filterMovementForFrame(
  m: ObsTfMovement,
  story: number,
  frame: number | null,
): ObsTfMovement {
  if (frame === null || frame === 0) return m;
  return {
    ...m,
    observation: m.observation?.filter((b) =>
      matchesFrameId(b.frameId, story, frame),
    ),
    translation: m.translation?.filter((b) =>
      matchesFrameId(b.frameId, story, frame),
    ),
    discourse: m.discourse?.filter((d) =>
      d.frameRefs.some((fr) => {
        const parts = fr.split("-");
        if (parts.length !== 2) return false;
        const f = Number.parseInt(parts[1], 10);
        return f === frame;
      }),
    ),
  };
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
  const part = resolvePart(opts);
  const narrow =
    part !== "full" &&
    part !== "intro" &&
    part !== "frames" &&
    part !== "community";

  const includeCommunity =
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

  movements = movements.map((m) =>
    filterMovementForFrame(m, ref.story, ref.frame),
  );

  let frames = bundle.story.frames;
  if (ref.frame !== null && ref.frame > 0) {
    frames = frames.filter((f) => f.index === ref.frame);
  }
  if (part !== "full" && part !== "frames" && part !== "intro") {
    // Keep frames only for full / frames / intro-adjacent whole-story views
    if (narrow || part === "community") frames = [];
  }
  if (part === "intro") frames = [];
  if (part === "frames") {
    // frames only
  }

  const intro =
    part === "full" || part === "intro"
      ? ref.frame === null || ref.frame === 0 || part === "intro"
        ? bundle.story.intro
        : undefined
      : undefined;

  const communityStudy = includeCommunity ? bundle.communityStudy : null;
  const drafting = draftingOf(bundle.story.movements);
  const checking = checkingOf(bundle.story.movements);

  const showConclusion =
    part === "full" || part === "conclusion" ? bundle.story.conclusion : null;
  const showDrafting =
    part === "full" || part === "drafting" || part === "movement2"
      ? drafting
      : null;
  const showChecking =
    part === "full" || part === "checking" || part === "movement3"
      ? checking
      : null;

  // For drafting/checking-only parts, still expose the parent movement shell
  if (part === "drafting" || part === "checking") {
    movements = movements.map((m) => {
      if (part === "drafting" && m.id === 2) {
        return {
          ...m,
          discourse: undefined,
          theological: undefined,
          markdown: m.drafting ?? "",
        };
      }
      if (part === "checking" && m.id === 3) {
        return {
          ...m,
          journal: undefined,
          markdown: m.checking ?? "",
        };
      }
      return m;
    });
  }

  const m1 = movements.find((m) => m.id === 1) ?? null;
  const m2 = movements.find((m) => m.id === 2) ?? null;
  const m3 = movements.find((m) => m.id === 3) ?? null;
  const m4 = movements.find((m) => m.id === 4) ?? null;
  const m5 = movements.find((m) => m.id === 5) ?? null;

  return {
    resourceType: "obs-tf" as const,
    identifier: "obs-tf",
    title: "OBS + Theological Formation",
    reference: ref.canonical,
    language: bundle.language,
    story: ref.story,
    frame: ref.frame,
    part,
    storyTitle: bundle.story.meta.subtitle,
    intro: part === "frames" || part === "community" ? undefined : intro,
    frames: part === "intro" || part === "community" ? [] : frames,
    bibleSource:
      part === "full" || part === "frames" ? bundle.story.bibleSource : null,
    communityStudy,
    communityStudyRef: includeCommunity
      ? bundle.story.communityStudyRef
      : null,
    drafting: showDrafting,
    checking: showChecking,
    conclusion: showConclusion,
    movements,
    /** Explicit section map for BT Servant / agent routing */
    sections: {
      intro: intro ?? null,
      frames: part === "full" || part === "frames" ? frames : null,
      communityStudy,
      movement1_biblicalInterpretation: m1,
      movement2_theologicalDialogue: m2,
      movement3_personalReflection: m3,
      movement4_ministryPractice: m4,
      movement5_missionalOutreach: m5,
      drafting: showDrafting,
      checking: showChecking,
      conclusion: showConclusion,
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

function movementHeading(m: ObsTfMovement): string {
  return `## Movement ${m.id}: ${m.title}`;
}

function appendMovementStructured(lines: string[], m: ObsTfMovement): void {
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
  const hasStructured =
    Boolean(m.observation?.length) ||
    Boolean(m.translation?.length) ||
    Boolean(m.discourse?.length) ||
    Boolean(m.theological?.length) ||
    Boolean(m.journal?.length) ||
    Boolean(m.drafting?.trim()) ||
    Boolean(m.checking?.trim());
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
