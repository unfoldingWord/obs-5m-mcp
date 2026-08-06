/**
 * Locate Indonesian PDF sections by section id, mapped onto English DCS slots.
 *
 * Algorithm:
 * 1. Section ids (0, 0.1, 1, 2.1, …) match English titles/positions from the structure map.
 * 2. Scan the source in document order.
 * 3. The text after each section id on the heading line is the Indonesian title.
 * 4. For major ids (1–7), prefer the last id-match before the next subsection
 *    (e.g. last `2 …` before `2.1`) so Bible-verse lines like `2 Sekalipun…`
 *    are not mistaken for chapter headings.
 */

import type { StructureSection } from "./structureMap.js";

export interface LocatedSection {
  key: string;
  id: string;
  enTitle: string;
  level: number;
  /** Full source heading without markdown marks: "2 Penafsiran Alkitabiah: …" */
  sourceTitle: string;
  /** Index of the heading match in source text */
  index: number;
  /** First character after the heading line */
  bodyStart: number;
}

/** Regex that finds a section-id heading line (id + following title text). */
export function sectionIdRegex(id: string): RegExp {
  const escaped = id.replace(/\./g, "\\.");
  if (id.includes(".")) {
    // Subsections: "0.1", "2.1" — unique enough; allow EOL after id
    return new RegExp(`^(?:#{1,6}\\s*)?(${escaped})(?:\\s+|$)`, "gim");
  }
  // Majors: "2" must not match "2.1"; require title text after the number
  return new RegExp(`^(?:#{1,6}\\s*)?(${escaped})(?!\\.\\d)\\s+\\S`, "gim");
}

function endOfLine(text: string, index: number): number {
  const nl = text.indexOf("\n", index);
  return nl < 0 ? text.length : nl + 1;
}

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end < 0 ? undefined : end).trim();
}

function stripMdHeadingMarks(line: string): string {
  return line.replace(/^#{1,6}\s*/, "").trim();
}

/** First heading match for `id` at or after `from` (and before `to` if set). */
export function findFirstSectionId(
  text: string,
  id: string,
  from = 0,
  to = text.length,
): number {
  const re = sectionIdRegex(id);
  re.lastIndex = 0;
  const slice = text.slice(from, to);
  const m = re.exec(slice);
  if (!m || m.index === undefined) return -1;
  return from + m.index;
}

/** Last heading match for `id` in `[from, to)`. */
export function findLastSectionId(
  text: string,
  id: string,
  from = 0,
  to = text.length,
): number {
  const re = sectionIdRegex(id);
  let last = -1;
  const slice = text.slice(from, to);
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(slice))) {
    if (m.index === undefined) break;
    last = from + m.index;
    // Avoid zero-length loops
    if (m[0].length === 0) re.lastIndex++;
  }
  return last;
}

/**
 * Cue pattern for a section id (compatible with legacy cueRegex / sliceByCues).
 */
export function sectionIdCuePattern(id: string): string {
  const escaped = id.replace(/\./g, "\\.");
  if (id.includes(".")) {
    return `^(?:#{1,6}\\s*)?${escaped}(?:\\s|$)`;
  }
  return `^(?:#{1,6}\\s*)?${escaped}(?!\\.\\d)\\s+\\S`;
}

/**
 * Locate all structure-map sections in `text`.
 * Returns a map keyed by section `key` (intro, keyIdea, …).
 */
export function locateStructureSections(
  text: string,
  sections: StructureSection[],
): Map<string, LocatedSection> {
  type Tentative = { sec: StructureSection; index: number };
  const positions: Array<Tentative | null> = sections.map(() => null);

  // Pass 1 — greedy first match after previous section (document order)
  let cursor = 0;
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!;
    const idx = findFirstSectionId(text, sec.id, cursor);
    if (idx < 0) continue;
    positions[i] = { sec, index: idx };
    cursor = endOfLine(text, idx);
  }

  // Pass 2 — majors: last id-match before next subsection / next located section
  // so verse lines (`2 Sekalipun…`) lose to real chapter titles (`2 Penafsiran…`).
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!;
    if (sec.id.includes(".")) continue;
    const cur = positions[i];
    if (!cur) continue;

    let windowEnd = text.length;
    const childPos = findFirstSectionId(text, `${sec.id}.1`, cur.index);
    if (childPos >= 0) windowEnd = Math.min(windowEnd, childPos);

    for (let j = i + 1; j < positions.length; j++) {
      const nxt = positions[j];
      if (nxt) {
        windowEnd = Math.min(windowEnd, nxt.index);
        break;
      }
    }

    const prevEnd =
      i > 0 && positions[i - 1]
        ? endOfLine(text, positions[i - 1]!.index)
        : 0;
    const refined = findLastSectionId(text, sec.id, prevEnd, windowEnd);
    if (refined >= 0) positions[i] = { sec, index: refined };
  }

  const out = new Map<string, LocatedSection>();
  for (const pos of positions) {
    if (!pos) continue;
    const { sec, index } = pos;
    const sourceTitle = stripMdHeadingMarks(lineAt(text, index))
      .replace(/\s+/g, " ")
      .trim();
    out.set(sec.key, {
      key: sec.key,
      id: sec.id,
      enTitle: sec.enTitle,
      level: sec.level,
      sourceTitle,
      index,
      bodyStart: endOfLine(text, index),
    });
  }
  return out;
}

/** Body text for `startKey`, ending at the earliest of `endKeys` (if found). */
export function bodyBetweenLocated(
  text: string,
  located: Map<string, LocatedSection>,
  startKey: string,
  endKeys?: string | string[],
): string {
  const start = located.get(startKey);
  if (!start) return "";
  let to = text.length;
  const ends = endKeys
    ? Array.isArray(endKeys)
      ? endKeys
      : [endKeys]
    : [];
  for (const key of ends) {
    const end = located.get(key);
    if (end && end.index > start.index && end.index < to) to = end.index;
  }
  return text.slice(start.bodyStart, to).trim();
}

/**
 * Drop the section id from a source heading, keeping only the title text.
 * "2 Penafsiran Alkitabiah: …" → "Penafsiran Alkitabiah: …"
 */
export function titleFromSourceHeading(
  sourceTitle: string,
  id?: string,
): string {
  const cleaned = sourceTitle.replace(/^#{1,6}\s*/, "").trim();
  if (!cleaned) return cleaned;
  if (id) {
    const escaped = id.replace(/\./g, "\\.");
    const stripped = cleaned
      .replace(new RegExp(`^${escaped}\\s+`), "")
      .trim();
    if (stripped) return stripped;
  }
  return cleaned.replace(/^\d+(?:\.\d+)?\s+/, "").trim() || cleaned;
}

/**
 * Strip PDF section ids (0–7 / N.N) from markdown heading lines so output
 * matches English DCS shape. Leaves frame markers (`#### 01-01`) untouched.
 */
export function stripSectionIdsFromHeadings(md: string): string {
  return md.replace(/^(#{1,6}\s+)([0-7](?:\.\d+)?)\s+/gm, "$1");
}

/**
 * Emit markdown heading at the English slot level with Indonesian title only
 * (section ids are omitted so output matches English DCS shape).
 */
export function headingFromLocated(
  located: LocatedSection | undefined,
  fallback: string,
): string {
  const level = located?.level ?? 2;
  const title = located
    ? titleFromSourceHeading(located.sourceTitle, located.id)
    : "";
  return `${"#".repeat(level)} ${title || fallback}`;
}
