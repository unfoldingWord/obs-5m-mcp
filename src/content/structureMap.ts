/**
 * Parameterized language structure maps + DCS structure comparison.
 *
 * Indonesian section ids map onto English DCS titles/positions. The text
 * after each section id in the source is the Indonesian section title.
 */

import idMap from "../../data/structure-maps/id.json";
import {
  parseObsTfStoryMarkdown,
  type ParsedObsTfStory,
} from "./obsTfParser.js";
import { sectionIdCuePattern } from "./sectionLocator.js";

export type StructureCueKey =
  | "intro"
  | "keyIdea"
  | "creedalVerse"
  | "metanarrative"
  | "storyFrames"
  | "communityStudy"
  | "biblicalInterpretation"
  | "observation"
  | "translation"
  | "theologicalDialogue"
  | "discourse"
  | "theological"
  | "drafting"
  | "personalReflection"
  | "journal"
  | "checking"
  | "ministry"
  | "missional"
  | "conclusion";

export type StructureMapCues = Record<StructureCueKey, string>;

export interface StructureSection {
  key: StructureCueKey;
  /** Indonesian PDF section id ("0", "0.1", "2", …) */
  id: string;
  /** English DCS title / slot this id maps to */
  enTitle: string;
  /** Markdown heading level at the English document position */
  level: number;
  packaging?: "inline" | "transclusion";
}

export interface StructureMap {
  language: string;
  languageName: string;
  referenceLanguage: string;
  referenceRepo: string;
  /** Ordered id → English slot map (document order) */
  sections: StructureSection[];
  /** Derived id-based cues (for legacy slice helpers) */
  cues: StructureMapCues;
  requiredChecks: string[];
  softChecks: string[];
}

function cuesFromSections(sections: StructureSection[]): StructureMapCues {
  const cues = {} as StructureMapCues;
  for (const s of sections) {
    cues[s.key] = sectionIdCuePattern(s.id);
  }
  return cues;
}

function normalizeMap(raw: {
  language: string;
  languageName: string;
  referenceLanguage: string;
  referenceRepo: string;
  sections?: StructureSection[];
  cues?: Partial<StructureMapCues>;
  requiredChecks: string[];
  softChecks: string[];
}): StructureMap {
  const sections = raw.sections ?? [];
  const cues =
    sections.length > 0
      ? cuesFromSections(sections)
      : (raw.cues as StructureMapCues);
  if (!cues || Object.keys(cues).length === 0) {
    throw new Error(`Structure map for "${raw.language}" has no sections/cues`);
  }
  return { ...raw, sections, cues };
}

export interface StructureProfile {
  storyNum: number;
  subtitle: string;
  frameIds: string[];
  frameCount: number;
  hasKeyIdea: boolean;
  hasCreedalVerse: boolean;
  hasMetanarrative: boolean;
  hasFrames: boolean;
  hasCommunityStudy: boolean;
  hasObservation: boolean;
  hasTranslation: boolean;
  hasDiscourse: boolean;
  hasTheological: boolean;
  hasJournal: boolean;
  hasDrafting: boolean;
  hasChecking: boolean;
  hasMinistry: boolean;
  hasMissional: boolean;
  hasConclusion: boolean;
  observationFrameIds: string[];
  translationFrameIds: string[];
  discourseCount: number;
  theologicalCount: number;
  journalCount: number;
  transclusionFiles: string[];
}

export interface StructureMismatch {
  check: string;
  severity: "required" | "soft";
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
}

export interface CompareResult {
  ok: boolean;
  mismatches: StructureMismatch[];
  converted: StructureProfile;
  reference: StructureProfile;
}

const MAPS: Record<string, StructureMap> = {
  id: normalizeMap(idMap as Parameters<typeof normalizeMap>[0]),
};

export function loadStructureMap(language: string): StructureMap {
  const code = language.toLowerCase().split("-")[0];
  const map = MAPS[code];
  if (!map) {
    throw new Error(`No structure map for language "${language}"`);
  }
  return map;
}

export function cueRegex(cue: string, flags = "im"): RegExp {
  return new RegExp(cue, flags);
}

export function buildDcsStructureProfile(md: string): StructureProfile {
  const story = parseObsTfStoryMarkdown(md);
  return profileFromParsed(story, md);
}

export function profileFromParsed(
  story: ParsedObsTfStory,
  rawMd?: string,
): StructureProfile {
  const md = rawMd ?? story.rawMarkdown;
  const m1 = story.movements.find((m) => m.id === 1);
  const m2 = story.movements.find((m) => m.id === 2);
  const m3 = story.movements.find((m) => m.id === 3);
  const files = story.transclusionRefs.map((r) => r.file);

  return {
    storyNum: story.meta.storyNum,
    subtitle: story.meta.subtitle,
    frameIds: story.frames.map((f) => f.id),
    frameCount: story.frames.length,
    hasKeyIdea: Boolean(story.intro.keyIdea?.trim()),
    hasCreedalVerse: Boolean(story.intro.creedalVerse?.trim()),
    hasMetanarrative: Boolean(story.intro.metanarrative?.trim()),
    hasFrames: story.frames.length > 0,
    hasCommunityStudy: Boolean(
      story.communityStudyRef ||
        story.inlineCommunityStudy?.trim() ||
        /^##?\s+(?:Community Study|Studi Komunitas|\d+\s+Studi Komunitas)/im.test(
          md,
        ),
    ),
    hasObservation: (m1?.observation?.length ?? 0) > 0,
    hasTranslation: (m1?.translation?.length ?? 0) > 0,
    hasDiscourse: (m2?.discourse?.length ?? 0) > 0,
    hasTheological: (m2?.theological?.length ?? 0) > 0,
    hasJournal: (m3?.journal?.length ?? 0) > 0,
    hasDrafting:
      files.some((f) => /movement_2_drafting/i.test(f)) ||
      Boolean(m2?.drafting?.trim()) ||
      /^#{1,3}\s+(?:Translation Draft|Naskah Awal Terjemahan)\b/im.test(md),
    hasChecking:
      files.some((f) => /movement_3_checking/i.test(f)) ||
      Boolean(m3?.checking?.trim()) ||
      /^#{1,3}\s+(?:Team Check|Pemeriksaan Tim)\b/im.test(md),
    hasMinistry:
      files.some((f) => /^movement_4$/i.test(f) || /movement_4\.md/i.test(f)) ||
      /^#{1,2}\s+(?:Ministry Practice|Praktik Pelayanan)\b/im.test(md),
    hasMissional:
      files.some((f) => /^movement_5$/i.test(f) || /movement_5\.md/i.test(f)) ||
      /^#{1,2}\s+(?:Missional Outreach|Penjangkauan Misi)\b/im.test(md),
    hasConclusion:
      files.some((f) => /conclusion/i.test(f)) ||
      Boolean(story.conclusion?.trim()) ||
      /^#{1,2}\s+(?:Conclusion|Kesimpulan)\s*$/im.test(md),
    observationFrameIds: (m1?.observation ?? []).map((b) => b.frameId),
    translationFrameIds: (m1?.translation ?? []).map((b) => b.frameId),
    discourseCount: m2?.discourse?.length ?? 0,
    theologicalCount: m2?.theological?.length ?? 0,
    journalCount: m3?.journal?.length ?? 0,
    transclusionFiles: [...new Set(files)],
  };
}

function pushMismatch(
  out: StructureMismatch[],
  map: StructureMap,
  check: string,
  message: string,
  expected?: string | number | boolean,
  actual?: string | number | boolean,
): void {
  const severity: "required" | "soft" = map.requiredChecks.includes(check)
    ? "required"
    : "soft";
  out.push({ check, severity, message, expected, actual });
}

export function compareStructures(
  convertedMd: string,
  referenceMd: string,
  map: StructureMap,
): CompareResult {
  const converted = buildDcsStructureProfile(convertedMd);
  const reference = buildDcsStructureProfile(referenceMd);
  const mismatches: StructureMismatch[] = [];

  const checks = new Set([...map.requiredChecks, ...map.softChecks]);

  if (checks.has("frameCountMatch")) {
    if (converted.frameCount !== reference.frameCount) {
      pushMismatch(
        mismatches,
        map,
        "frameCountMatch",
        `Frame count differs from DCS reference`,
        reference.frameCount,
        converted.frameCount,
      );
    }
  }

  const boolChecks: Array<[string, keyof StructureProfile]> = [
    ["hasKeyIdea", "hasKeyIdea"],
    ["hasCreedalVerse", "hasCreedalVerse"],
    ["hasMetanarrative", "hasMetanarrative"],
    ["hasFrames", "hasFrames"],
    ["hasObservation", "hasObservation"],
    ["hasTranslation", "hasTranslation"],
    ["hasDiscourse", "hasDiscourse"],
    ["hasTheological", "hasTheological"],
    ["hasJournal", "hasJournal"],
    ["hasCommunityStudy", "hasCommunityStudy"],
    ["hasDrafting", "hasDrafting"],
    ["hasChecking", "hasChecking"],
    ["hasMinistry", "hasMinistry"],
    ["hasMissional", "hasMissional"],
    ["hasConclusion", "hasConclusion"],
  ];

  for (const [check, key] of boolChecks) {
    if (!checks.has(check)) continue;
    if (reference[key] && !converted[key]) {
      pushMismatch(
        mismatches,
        map,
        check,
        `Missing ${check} present in DCS reference`,
        true,
        false,
      );
    }
  }

  if (checks.has("observationFrameCoverage") && reference.frameIds.length) {
    const missing = reference.frameIds.filter(
      (id) => !converted.observationFrameIds.includes(id),
    );
    if (missing.length) {
      pushMismatch(
        mismatches,
        map,
        "observationFrameCoverage",
        `Observation missing frames: ${missing.join(", ")}`,
        reference.frameIds.length,
        converted.observationFrameIds.length,
      );
    }
  }

  const ok = !mismatches.some((m) => m.severity === "required");
  return { ok, mismatches, converted, reference };
}
