/**
 * Convert extracted PDF plain text / font-aware plain MD → en_obs_tf-shaped markdown.
 */

import {
  cueRegex,
  loadStructureMap,
  type StructureCueKey,
  type StructureMap,
  type StructureMapCues,
} from "./structureMap.js";
import {
  bodyBetweenLocated,
  headingFromLocated,
  locateStructureSections,
  stripSectionIdsFromHeadings,
  type LocatedSection,
} from "./sectionLocator.js";

export interface ConvertPdfOptions {
  language?: string;
  storyNum: number;
  pdfText: string;
  /** Optional DCS en_obs_tf markdown for frame/image hints */
  dcsReferenceMd?: string;
  structureMap?: StructureMap;
}

export interface ConvertPdfResult {
  storyMarkdown: string;
  transclusions: Record<string, string>;
  subtitle: string;
  storyNum: number;
  language: string;
}

type CueKey = StructureCueKey;

/** Language-aware boilerplate when PDF section blurbs cannot be sliced. */
const FALLBACKS = {
  en: {
    docTitle: "Open Bible Stories",
    observationIntro:
      "Answer the following observation questions to gain a basic understanding of the story. Read the story as a community and answer these questions as a group.",
    translationIntro:
      "Use the following translation questions to understand specific details of the passage. Discuss how you might translate these specific elements of the story.",
    discourseIntro:
      "Use the following discourse questions to understand the meaning of the story. Pay attention to how the story itself addresses each question or theme.",
    biblicalIntro:
      "After reading the crafted biblical story, answer the following questions to familiarize yourself with the details of the story.",
    theologicalIntro:
      "Take time to explore the meaning of this story together as a community. Use the following discussions as a way to grasp what truth the story teaches.",
    personalReflectionIntro:
      "Take a moment to allow this story to evaluate your own life and to consider how God would have you respond.",
    headings: {
      intro: "Introduction",
      keyIdea: "Key Idea",
      creedalVerse: "Creedal Verse",
      metanarrative: "Metanarrative Summary",
      storyFrames: "Open Bible Story",
      biblicalInterpretation:
        "Biblical Interpretation: Observing the Details of the Story",
      observation: "Observation Questions",
      translation: "Translation Questions",
      theologicalDialogue:
        "Theological Dialogue: Discussing the Meaning of the Story",
      discourse: "Discourse Questions",
      theological: "Theological Questions",
      personalReflection:
        "Personal Reflection: Following the Teaching of the Story",
      journal: "Journal Reflection",
      drafting: "Movement 2 Drafting",
      checking: "Movement 3 Checking",
      ministry: "Ministry Practice",
      missional: "Missional Outreach",
      conclusion: "Conclusion",
      communityStudy: "Community Study",
    },
  },
  id: {
    docTitle: "Cerita Alkitab Terbuka",
    observationIntro:
      "Jawablah pertanyaan-pertanyaan observasi berikut untuk memahami dasar cerita. Bacalah cerita bersama komunitas dan jawab pertanyaan-pertanyaan ini sebagai kelompok.",
    translationIntro:
      "Gunakan pertanyaan-pertanyaan penerjemahan berikut untuk memahami detail spesifik dari bagian ini. Diskusikan bagaimana Anda mungkin menerjemahkan unsur-unsur khusus dari cerita.",
    discourseIntro:
      "Gunakan pertanyaan-pertanyaan diskursus berikut untuk memahami makna cerita. Perhatikan bagaimana cerita itu sendiri menangani setiap pertanyaan atau tema.",
    biblicalIntro:
      "Setelah membaca cerita Alkitab yang disusun, jawablah pertanyaan-pertanyaan berikut untuk mengenal detail cerita.",
    theologicalIntro:
      "Luangkan waktu untuk menjelajahi makna cerita ini bersama sebagai komunitas. Gunakan diskusi berikut untuk memahami kebenaran yang diajarkan cerita.",
    personalReflectionIntro:
      "Luangkan waktu sejenak agar cerita ini mengevaluasi hidup Anda sendiri dan pertimbangkan bagaimana Allah ingin Anda merespons.",
    headings: {
      intro: "Pengantar",
      keyIdea: "Pokok Pikiran Utama",
      creedalVerse: "Ayat Pengakuan Iman",
      metanarrative: "Rangkuman Metanarasi",
      storyFrames: "Cerita Alkitab Terbuka",
      biblicalInterpretation: "Penafsiran Alkitabiah: Mengamati Detail Cerita",
      observation: "Pertanyaan-Pertanyaan Observasi",
      translation: "Pertanyaan-Pertanyaan Penerjemahan",
      theologicalDialogue: "Dialog Teologis: Membahas Makna dari Cerita",
      discourse: "Pertanyaan-pertanyaan Diskursus",
      theological: "Pertanyaan-pertanyaan Teologis",
      personalReflection: "Refleksi Pribadi: Mengikuti Pengajaran dari Cerita",
      journal: "Refleksi Jurnal",
      drafting: "Naskah Awal Terjemahan",
      checking: "Pemeriksaan Tim",
      ministry: "Praktik Pelayanan",
      missional: "Penjangkauan Misi",
      conclusion: "Kesimpulan",
      communityStudy: "Studi Komunitas",
    },
  },
} as const;

type FallbackPack = (typeof FALLBACKS)[keyof typeof FALLBACKS];

function fallbacksFor(language: string): FallbackPack {
  return language === "id" ? FALLBACKS.id : FALLBACKS.en;
}

/** Strip YAML frontmatter from font-aware plain MD inputs. */
export function stripYamlFrontmatter(md: string): string {
  const text = md.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  return text.slice(end + 4).replace(/^\s*\n/, "");
}

/**
 * Remove PDF page-number noise: bare lines (`8`) and trailing line-end
 * numbers (`…keluarganya. 8`) so they cannot collide with structure cues
 * or pollute content coverage windows.
 */
export function scrubBarePageNumbers(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+\d{1,3}\s*$/u, "").trimEnd())
    .filter((line) => !/^\s*\d{1,3}\s*$/u.test(line))
    .join("\n");
}

function sliceByCues(
  text: string,
  cues: StructureMapCues,
  start: CueKey,
  end?: CueKey | CueKey[],
): string {
  const startRe = cueRegex(cues[start]);
  const startMatch = startRe.exec(text);
  if (!startMatch || startMatch.index === undefined) return "";
  // Skip remainder of the heading line (e.g. " Alkitabiah: …") so body starts clean
  let from = startMatch.index + startMatch[0].length;
  const nl = text.indexOf("\n", from);
  if (nl >= from) from = nl + 1;
  let to = text.length;
  if (end) {
    const ends = Array.isArray(end) ? end : [end];
    let best: number | null = null;
    const rest = text.slice(from);
    for (const e of ends) {
      const endRe = cueRegex(cues[e]);
      const endMatch = endRe.exec(rest);
      if (endMatch && endMatch.index !== undefined) {
        if (best === null || endMatch.index < best) best = endMatch.index;
      }
    }
    if (best !== null) to = from + best;
  }
  return text.slice(from, to).trim();
}

function firstLineMatch(text: string, cue: string): string | null {
  const m = cueRegex(cue).exec(text);
  if (!m) return null;
  const lineStart = text.lastIndexOf("\n", m.index) + 1;
  const lineEnd = text.indexOf("\n", m.index);
  return text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
}

function reflow(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    // Join soft-wrapped hyphens / frame ids across line breaks
    .replace(/(\d{2})-\s*\n\s*(\d{2})/g, "$1-$2")
    .replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([A-Za-zÀ-ÿ])/g, "$1-$2")
    .replace(/(ke)-\s*\n\s*(\d)/gi, "$1-$2")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/(\d{2})-\s+(\d{2})/g, "$1-$2")
    .replace(/(ke)-\s+(\d)/gi, "$1-$2")
    .trim();
}

function stripMdHeadingMarks(line: string): string {
  return line.replace(/^#{1,6}\s*/, "").trim();
}

/**
 * Locate a section by its PDF number (via cue), then emit the PDF's own
 * heading text at the given markdown level. Falls back to a language-local
 * label only when the numbered heading is missing.
 */
function headingFromCue(
  text: string,
  cue: string,
  level: number,
  fallback: string,
): string {
  const line = firstLineMatch(text, cue);
  if (!line) return `${"#".repeat(level)} ${fallback}`;
  const clean = stripMdHeadingMarks(line).replace(/\s+/g, " ").trim();
  return `${"#".repeat(level)} ${clean || fallback}`;
}

function extractDocTitle(text: string, language = "en"): string {
  // Prefer brand / series title at any heading level
  const brand =
    /^(?:#{1,6}\s*)?(Cerita Alkitab Terbuka|Alkitab Bergambar(?: Untuk Semua)?)\s*$/im.exec(
      text,
    );
  if (brand?.[1]?.trim()) return brand[1].trim();

  const md = /^#\s+(.+)$/m.exec(text);
  if (md?.[1]?.trim() && !/mengajarkan/i.test(md[1])) return md[1].trim();

  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/^(?:\d+(?:\.\d+)?\b|#)/.test(line)) continue;
    if (/Cerita Alkitab Terbuka|Alkitab Bergambar/i.test(line)) return line;
    // Skip key-idea / body sentences mistaken for titles
    if (/mengajarkan|berikut|cerita tentang/i.test(line)) continue;
    if (line.length >= 8 && line.length <= 60 && !/[.!?]$/.test(line)) {
      return line;
    }
  }
  return fallbacksFor(language).docTitle;
}

function extractSubtitle(
  text: string,
  cues: StructureMapCues,
  located?: Map<string, LocatedSection>,
): string {
  // Prefer the cover/story number line ("14. Mengembara…") — section 0.4
  // headings sometimes have PDF typos (e.g. Mengambara vs Mengembara).
  const numbered = /^(?:#{1,6}\s*)?\d{1,2}\.\s+(.+)$/m.exec(text);
  if (
    numbered?.[1] &&
    !/mengajarkan/i.test(numbered[1]) &&
    numbered[1].length <= 80
  ) {
    return numbered[1].trim();
  }
  const storyTitle = located?.get("storyFrames")?.sourceTitle;
  const storyLine = storyTitle || firstLineMatch(text, cues.storyFrames);
  if (storyLine) {
    const clean = stripMdHeadingMarks(storyLine);
    const m = /Cerita Alkitab(?:\s+Terbuka)?:\s*(.+)$/i.exec(clean);
    if (m) return m[1].trim();
  }
  // Font-aware plain MD often has "## Penciptaan" near the top
  const headingTitle = /^##\s+(?!0\b)(.+)$/m.exec(text);
  if (
    headingTitle?.[1] &&
    !/Cerita Alkitab|Alkitab Bergambar/i.test(headingTitle[1])
  ) {
    return headingTitle[1].trim();
  }
  const lines = text
    .split(/\n/)
    .map((l) => stripMdHeadingMarks(l.trim()))
    .filter(Boolean);
  if (lines[1] && !/^\d/.test(lines[1])) return lines[1];
  return "OBS Story";
}

function extractBibleSource(frameSection: string): string | null {
  const m =
    /Sebuah [Cc]erita Alkitab dari:\s*(.+)$/im.exec(frameSection) ||
    /A Bible story from:\s*(.+)$/im.exec(frameSection);
  return m ? m[1].trim() : null;
}

function extractCommunityTitle(
  text: string,
  cues: StructureMapCues,
  dcsMd?: string,
  located?: Map<string, LocatedSection>,
): string {
  // Prefer PDF/source heading (text after section id); DCS EN title last resort
  const line =
    located?.get("communityStudy")?.sourceTitle ||
    firstLineMatch(text, cues.communityStudy);
  if (line) {
    const clean = stripMdHeadingMarks(line)
      .replace(/^1\s+Studi Komunitas:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean) return clean;
  }
  return communityTitleFromDcs(dcsMd) || "Community Study";
}

function cleanCommunityBody(body: string): string {
  return body
    .replace(/^[:\s]*Praktik[^\n]*\n?/i, "")
    .replace(/^#{1,6}\s*1\s+Studi Komunitas:[^\n]*\n?/i, "")
    .trim();
}

interface FrameBlock {
  id: string;
  index: number;
  text: string;
}

function frameMarkerRegex(storyNum: number): RegExp {
  const pad = String(storyNum).padStart(2, "0");
  // bare 01-01 or markdown **01-01**
  return new RegExp(`^(?:\\*\\*)?${pad}-(\\d{2})(?:\\*\\*)?\\s*$`, "gm");
}

function parseFrameBlocks(section: string, storyNum: number): FrameBlock[] {
  const pad = String(storyNum).padStart(2, "0");
  const re = frameMarkerRegex(storyNum);
  const matches = [...section.matchAll(re)];
  const frames: FrameBlock[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const index = Number.parseInt(m[1]!, 10);
    const start = (m.index ?? 0) + m[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? section.length)
        : section.length;
    let body = section.slice(start, end).trim();
    body = body
      .replace(/Sebuah [Cc]erita Alkitab dari:[\s\S]*$/i, "")
      .replace(/A Bible story from:[\s\S]*$/i, "")
      .trim();
    if (frames.some((f) => f.index === index)) continue;
    frames.push({
      id: `${pad}-${String(index).padStart(2, "0")}`,
      index,
      text: reflow(body),
    });
  }
  return frames;
}

/** Prefatory blurb before the first frame marker in a section. */
function sectionIntroBeforeFrames(
  section: string,
  storyNum: number,
  fallback: string,
): string {
  const re = frameMarkerRegex(storyNum);
  re.lastIndex = 0;
  const m = re.exec(section);
  const preface = (m?.index !== undefined ? section.slice(0, m.index) : section)
    .trim();
  const cleaned = reflow(preface);
  if (cleaned && cleaned.length > 20 && cleaned.length < 500) return cleaned;
  return fallback;
}

function parseObservationMd(
  section: string,
  storyNum: number,
  heading = "### Observation Questions",
  language = "en",
): string {
  const pad = String(storyNum).padStart(2, "0");
  const re = frameMarkerRegex(storyNum);
  const matches = [...section.matchAll(re)];
  if (!matches.length) return "";

  const intro = sectionIntroBeforeFrames(
    section,
    storyNum,
    fallbacksFor(language).observationIntro,
  );

  const parts: string[] = [heading, "", intro, ""];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const id = `${pad}-${m[1]}`;
    const start = (m.index ?? 0) + m[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? section.length)
        : section.length;
    const body = section.slice(start, end).trim();
    const qa = pairQuestionsAnswers(body);
    parts.push(`#### ${id}`, "");
    if (!qa.length && body) {
      parts.push(reflow(body), "");
    } else {
      for (const { question, answer } of qa) {
        parts.push(question, answer, "");
      }
    }
  }
  return parts.join("\n");
}

/**
 * Pair observation Q&A from frame body text.
 *
 * Important: do NOT scan `/[^?]+?\?/g` on a fully reflowed single line —
 * after the first "?", the next match starts at the answer and swallows
 * "answer + next question" until the following "?", dropping the first Q
 * (empty answer) and corrupting the second.
 *
 * Instead, soft-join wrapped lines into paragraphs, then treat each
 * paragraph ending in "?" as a full question and the following non-?
 * paragraph(s) as its answer. Never start a question at mid-phrase
 * Apa/Apakah (that truncated "Kehidupan seperti apa…", "Ke mana…").
 */
function pairQuestionsAnswers(
  body: string,
): Array<{ question: string; answer: string }> {
  const paragraphs = softJoinParagraphs(body);
  if (!paragraphs.length) return [];

  const items: Array<{ question: string; answer: string }> = [];
  let question: string | null = null;
  let answerParts: string[] = [];

  const flush = () => {
    if (question && answerParts.length) {
      items.push({
        question,
        answer: answerParts.join(" ").replace(/\s+/g, " ").trim(),
      });
    }
    question = null;
    answerParts = [];
  };

  for (const p of paragraphs) {
    if (p.endsWith("?")) {
      flush();
      question = p;
    } else if (question) {
      answerParts.push(p);
    }
  }
  flush();
  return items;
}

/** Soft-join PDF line wraps; keep breaks after sentence/.?/! terminators. */
function softJoinParagraphs(body: string): string[] {
  const lines = body
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2})-\s*\n\s*(\d{2})/g, "$1-$2")
    .replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([A-Za-zÀ-ÿ])/g, "$1-$2")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (!buf) {
      buf = line;
      continue;
    }
    if (/[?.!…]["'”’)]*$/.test(buf)) {
      out.push(buf.replace(/\s+/g, " ").trim());
      buf = line;
    } else {
      buf = `${buf} ${line}`;
    }
  }
  if (buf) out.push(buf.replace(/\s+/g, " ").trim());
  return out;
}

function parseTranslationMd(
  section: string,
  storyNum: number,
  heading = "### Translation Questions",
  language = "en",
): string {
  const pad = String(storyNum).padStart(2, "0");
  const re = frameMarkerRegex(storyNum);
  const matches = [...section.matchAll(re)];
  if (!matches.length) return "";

  const intro = sectionIntroBeforeFrames(
    section,
    storyNum,
    fallbacksFor(language).translationIntro,
  );

  const parts: string[] = [heading, "", intro, ""];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const id = `${pad}-${m[1]}`;
    const start = (m.index ?? 0) + m[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? section.length)
        : section.length;
    const body = section.slice(start, end).trim();
    parts.push(`#### ${id}`, "");
    const terms = splitTranslationTerms(body);
    if (!terms.length && body) {
      parts.push(reflow(body), "");
    } else {
      for (const t of terms) {
        parts.push(`**${t.term}** ${t.guidance}`, "");
      }
    }
  }
  return parts.join("\n");
}

/** Capital words that typically open translation-term guidance (not title case in the term). */
const GUIDANCE_START =
  /^(Allah|Ini|Kata|Bagaimana|Jika|Yakin|Dalam|Bentuknya|Orang|Air|Hal|Mematuhi|Mereka|Ia|Dia|Sebuah|Sebagai|Perintah|Istilah|Awan|Api|Bangsa|Musa|Firaun|Nuh|Abraham|Setelah|Sebelum|Ketika|Kemudian|Maka|Lalu|Namun|Karena|Anak|Hewan|Binatang|Tiang|Pilar|Gunung|Laut|Tanah|Umat|Israel|Mesir|Firaun)\b/u;

/**
 * Split translation "term + guidance …?" blocks from a frame body.
 *
 * Indonesian PDFs often omit the period after the term:
 *   Taatilah Aku dan peliharalah perjanjian
 *   Allah memerintahkan … ?
 * Reflowing into one line then matching `Term.` drops those (first `.` is
 * deep in the guidance and exceeds the word cap). Keep soft line breaks
 * between a term line and the following capital-started guidance.
 */
export function splitTranslationTerms(
  body: string,
): Array<{ term: string; guidance: string }> {
  const lines = prepareTranslationLines(body);
  if (!lines.length) return [];

  const items: Array<{ term: string; guidance: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    // Prefer periodless "term CapitalGuidance" (incl. lowercase terms like
    // "menuntun mereka Allah…") before "Term. guidance" — otherwise the first
    // "." deep in the guidance exceeds the word cap and the term is dropped.
    // Require a guidance-starter capital so "Taatilah Aku…" is not split.
    const periodless =
      /^((?:[A-Za-zÀ-ÿ'’"“”\-]+(?:\s+[A-Za-zÀ-ÿ'’"“”\-]+){0,11}))\s+([A-ZÀ-Ÿ].+)$/u.exec(
        line,
      );
    const inline = /^(.+?)[.!]\s+(.+)$/u.exec(line);
    const periodlessOk =
      !!periodless &&
      !/[.!?]/u.test(periodless[1]!) &&
      periodless[1]!.trim().split(/\s+/).length <= 12 &&
      GUIDANCE_START.test(periodless[2]!);
    if (line.endsWith("?") && !periodlessOk && !inline) {
      i += 1;
      continue;
    }

    let term = "";
    const guidanceParts: string[] = [];
    if (periodlessOk && periodless) {
      term = periodless[1]!.trim();
      guidanceParts.push(periodless[2]!.trim());
      i += 1;
    } else if (inline) {
      term = inline[1]!.trim();
      guidanceParts.push(inline[2]!.trim());
      i += 1;
    } else {
      term = line.replace(/[.!]+$/u, "").trim();
      i += 1;
    }
    if (!term || term.split(/\s+/).length > 18 || term.length > 140) {
      // Not a term — skip until next "?" so we resync
      while (i < lines.length && !lines[i]!.endsWith("?")) i += 1;
      if (i < lines.length) i += 1;
      continue;
    }

    // Guidance may already be complete on the term line ("…?")
    const alreadyComplete = guidanceParts.some((p) => p.endsWith("?"));
    while (!alreadyComplete && i < lines.length) {
      const g = lines[i]!;
      guidanceParts.push(g);
      i += 1;
      if (g.endsWith("?")) break;
    }
    const guidance = guidanceParts.join(" ").replace(/\s+/g, " ").trim();
    if (guidance) items.push({ term, guidance });
  }
  return items;
}

/** Soft-join wrapped guidance; keep breaks before new capital-started lines. */
function prepareTranslationLines(body: string): string[] {
  const raw = body
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2})-\s*\n\s*(\d{2})/g, "$1-$2")
    .replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([A-Za-zÀ-ÿ])/g, "$1-$2")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const line of raw) {
    if (!lines.length) {
      lines.push(line);
      continue;
    }
    const prev = lines[lines.length - 1]!;
    const prevEnds = /[?.!…]["'”’)]*$/u.test(prev);
    const contLower = /^[a-zà-ÿ]/u.test(line);
    const contAfterComma = /[,;:]$/u.test(prev);
    if (!prevEnds && (contLower || contAfterComma)) {
      lines[lines.length - 1] = `${prev} ${line}`.replace(/\s+/g, " ");
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Count `**term**` lines in converted translation markdown (for soft metrics). */
export function countTranslationTerms(storyMarkdown: string): {
  total: number;
  perFrame: Record<string, number>;
  fragmentedFrames: string[];
} {
  const perFrame: Record<string, number> = {};
  const translationBlock =
    /###\s+(?:Translation Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*(?:Penerjemahan|terjemahan)|2\.2\b)([\s\S]*?)(?=\n## |\n!\[\[|$)/i.exec(
      storyMarkdown,
    )?.[1] ?? "";
  let current: string | null = null;
  for (const line of translationBlock.split("\n")) {
    const frame = /^####\s+(\d{2}-\d{2})\s*$/.exec(line);
    if (frame) {
      current = frame[1]!;
      perFrame[current] ??= 0;
      continue;
    }
    if (current && /^\*\*[^*]+\*\*\s+\S/.test(line)) {
      perFrame[current]! += 1;
    }
  }
  const total = Object.values(perFrame).reduce((a, b) => a + b, 0);
  // Suspiciously fragmented: many tiny bold fragments (heuristic: >12 terms/frame)
  const fragmentedFrames = Object.entries(perFrame)
    .filter(([, n]) => n === 0 || n > 12)
    .map(([id]) => id);
  return { total, perFrame, fragmentedFrames };
}

function parseDiscourseMd(
  section: string,
  heading = "### Discourse Questions",
  language = "en",
): string {
  const fallbackIntro = fallbacksFor(language).discourseIntro;

  // Soft-wrapped frame refs like "(01-04, 01-\n05," → "(01-04, 01-05,"
  let reflowed = reflow(section)
    .replace(/(\d{2})-\s+(\d{2})/g, "$1-$2")
    .replace(/\bke-\s+(\d)/gi, "ke-$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");

  // Prefer Indonesian (or source) lead-in before first discourse question.
  // Do not require a fixed second word after Apa/Apakah/Bagaimana — PDF
  // wording varies ("Apakah pola…", "Bagaimana Allah…", "Hal-hal apa…").
  let intro = fallbackIntro;
  const firstQ = reflowed.search(
    /(?:Bagaimana|Apa|Apakah|Mengapa|Siapa|Siapakah|Hal-hal|What|How|Why|Who)\b[\s\S]{0,320}?\?\s*(?:[^?]{0,240}\?\s*)*\(\d{2}-\d{2}/i,
  );
  if (firstQ > 0) {
    const preface = reflowed.slice(0, firstQ).trim();
    if (
      preface.length > 20 &&
      (preface.length < 600 ||
        /Gunakan pertanyaan|diskursus|diskusi|discourse/i.test(preface))
    ) {
      intro = preface;
    }
    reflowed = reflowed.slice(firstQ);
  }

  const parts: string[] = [heading, "", intro, ""];

  // Question heading may include multiple "?" before the frame-ref paren group
  const qRe =
    /((?:[^?()]+?\?\s*)+\([^)]*\d{2}-\d{2}[^)]*\))\s*(.+?)(?=(?:[^?()]+?\?\s*)+\([^)]*\d{2}-\d{2}|$)/g;

  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = qRe.exec(reflowed))) {
    matched = true;
    parts.push(`##### ${m[1]!.trim()}`, m[2]!.trim(), "");
  }
  if (!matched && reflowed.trim()) {
    parts.push(`##### Discourse`, reflowed.trim(), "");
  }
  return parts.join("\n");
}

function parseNumberedQuestionsMd(section: string, heading: string): string {
  const collapsed = reflow(section);
  const headingLine = heading.startsWith("#") ? heading : `### ${heading}`;
  const parts: string[] = [headingLine, ""];
  const items = [
    ...collapsed.matchAll(/(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s+|$)/g),
  ];
  if (!items.length) {
    if (collapsed) {
      parts.push(collapsed, "");
    }
    return parts.join("\n");
  }
  // Keep instructional preface before "1." (PDF section intros)
  const firstNum = /(?:^|\s)1\.\s+/.exec(collapsed);
  if (firstNum?.index !== undefined && firstNum.index > 0) {
    const preface = collapsed.slice(0, firstNum.index).trim();
    if (preface.length > 20) parts.push(preface, "");
  }
  for (const it of items) {
    parts.push(`${it[1]}. ${it[2]!.trim()}`);
  }
  parts.push("");
  return parts.join("\n");
}

function dcsFrameImageMap(dcsMd?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!dcsMd) return map;
  const re = /^#{6,9}\s+(\d{2}-\d{2})\s*\n!\[\[([^\]]+)\]\]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dcsMd))) {
    map.set(m[1]!, m[2]!);
  }
  return map;
}

function communityTitleFromDcs(dcsMd?: string): string | null {
  if (!dcsMd) return null;
  const m =
    /!\[\[([^#]+)#Community Study:\s*([^\]]+)\]\]/i.exec(dcsMd) ||
    /##\s+Community Study:\s*(.+)$/im.exec(dcsMd);
  return m ? (m[2] ?? m[1])!.trim() : null;
}

function biblicalIntro(
  text: string,
  located: Map<string, LocatedSection>,
  language = "en",
): string {
  const blurb = bodyBetweenLocated(
    text,
    located,
    "biblicalInterpretation",
    "observation",
  );
  const cleaned = reflow(blurb);
  if (cleaned && cleaned.length < 400) return cleaned;
  return fallbacksFor(language).biblicalIntro;
}

function theologicalIntro(
  text: string,
  located: Map<string, LocatedSection>,
  language = "en",
): string {
  const blurb = bodyBetweenLocated(
    text,
    located,
    "theologicalDialogue",
    "discourse",
  );
  const cleaned = reflow(blurb);
  if (cleaned && cleaned.length < 400) return cleaned;
  return fallbacksFor(language).theologicalIntro;
}

function personalReflectionIntro(
  text: string,
  located: Map<string, LocatedSection>,
  language = "en",
): string {
  const blurb = bodyBetweenLocated(
    text,
    located,
    "personalReflection",
    "journal",
  );
  const cleaned = reflow(blurb);
  if (cleaned && cleaned.length < 500) return cleaned;
  return fallbacksFor(language).personalReflectionIntro;
}

export function convertPdfTextToObsTfMd(
  options: ConvertPdfOptions,
): ConvertPdfResult {
  const language = options.language ?? "id";
  const fb = fallbacksFor(language);
  const map = options.structureMap ?? loadStructureMap(language);
  const { cues, sections } = map;
  const text = scrubBarePageNumbers(
    stripYamlFrontmatter(options.pdfText).replace(/\r\n/g, "\n"),
  );
  // Section ids → English slots; text after each id = Indonesian title
  const located = locateStructureSections(text, sections);
  const storyNum = options.storyNum;
  const subtitle = extractSubtitle(text, cues, located);
  const images = dcsFrameImageMap(options.dcsReferenceMd);
  const communityTitle = extractCommunityTitle(
    text,
    cues,
    options.dcsReferenceMd,
    located,
  );
  const body = (start: CueKey, end?: CueKey | CueKey[]) =>
    bodyBetweenLocated(text, located, start, end);

  const keyIdea = reflow(body("keyIdea", "creedalVerse"));
  const creedalVerse = reflow(body("creedalVerse", "metanarrative"));
  const metanarrative = reflow(body("metanarrative", "storyFrames"));
  const frameSection = body("storyFrames", "communityStudy");
  const frames = parseFrameBlocks(frameSection, storyNum);
  const bibleSource = extractBibleSource(frameSection);

  const communityBody = cleanCommunityBody(
    body("communityStudy", ["biblicalInterpretation", "observation"]),
  );

  const observationBody = body("observation", "translation");
  const translationBody = body("translation", "theologicalDialogue");
  const discourseBody = body("discourse", "theological");
  // Optional sections: always bound by the next present sibling too
  const theologicalBody = body("theological", [
    "drafting",
    "personalReflection",
  ]);
  const draftingBody = body("drafting", "personalReflection");
  const journalBody = body("journal", ["checking", "ministry"]);
  const checkingBody = body("checking", "ministry");
  const ministryBody = body("ministry", "missional");
  const missionalBody = body("missional", "conclusion");
  const conclusionBody = body("conclusion");

  // English level/position from map; title = Indonesian text after section id
  const hIntro = headingFromLocated(located.get("intro"), fb.headings.intro);
  const hKeyIdea = headingFromLocated(
    located.get("keyIdea"),
    fb.headings.keyIdea,
  );
  const hCreedal = headingFromLocated(
    located.get("creedalVerse"),
    fb.headings.creedalVerse,
  );
  const hMeta = headingFromLocated(
    located.get("metanarrative"),
    fb.headings.metanarrative,
  );
  const hStory = headingFromLocated(
    located.get("storyFrames"),
    `${fb.headings.storyFrames}: ${subtitle}`,
  );
  const hBiblical = headingFromLocated(
    located.get("biblicalInterpretation"),
    fb.headings.biblicalInterpretation,
  );
  const hObservation = headingFromLocated(
    located.get("observation"),
    fb.headings.observation,
  );
  const hTranslation = headingFromLocated(
    located.get("translation"),
    fb.headings.translation,
  );
  const hDialogue = headingFromLocated(
    located.get("theologicalDialogue"),
    fb.headings.theologicalDialogue,
  );
  const hDiscourse = headingFromLocated(
    located.get("discourse"),
    fb.headings.discourse,
  );
  const hTheological = headingFromLocated(
    located.get("theological"),
    fb.headings.theological,
  );
  const hReflection = headingFromLocated(
    located.get("personalReflection"),
    fb.headings.personalReflection,
  );
  const hJournal = headingFromLocated(
    located.get("journal"),
    fb.headings.journal,
  );
  const hDrafting = headingFromLocated(
    located.get("drafting"),
    fb.headings.drafting,
  );
  const hChecking = headingFromLocated(
    located.get("checking"),
    fb.headings.checking,
  );
  const hMinistry = headingFromLocated(
    located.get("ministry"),
    fb.headings.ministry,
  );
  const hMissional = headingFromLocated(
    located.get("missional"),
    fb.headings.missional,
  );
  const hConclusion = headingFromLocated(
    located.get("conclusion"),
    fb.headings.conclusion,
  );
  const hCommunity = headingFromLocated(
    located.get("communityStudy"),
    `${fb.headings.communityStudy}: ${communityTitle}`,
  );

  const observationMd = parseObservationMd(
    observationBody,
    storyNum,
    hObservation,
    language,
  );
  const translationMd = parseTranslationMd(
    translationBody,
    storyNum,
    hTranslation,
    language,
  );
  const discourseMd = parseDiscourseMd(discourseBody, hDiscourse, language);
  const theologicalMd = parseNumberedQuestionsMd(theologicalBody, hTheological);
  const journalMd = parseNumberedQuestionsMd(journalBody, hJournal);

  // Shared across stories → TX + wiki link (EN-style).
  // Story-unique (community study) → embedded in the story file.
  // Convert script inlines divergent movement/conclusion variants too.
  const draftingFile = "movement_2_drafting";
  const checkingFile = "movement_3_checking";
  const ministryFile = "movement_4";
  const missionalFile = "movement_5";
  const conclusionFile = "conclusion";

  const communityMd = communityBody.trim()
    ? `${hCommunity}\n\n${communityBody.trim()}\n`
    : "";

  const transclusions: Record<string, string> = {};
  if (draftingBody.trim()) {
    transclusions[`${draftingFile}.md`] =
      `${hDrafting}\n\n${reflow(draftingBody)}\n`;
  }
  if (checkingBody.trim()) {
    transclusions[`${checkingFile}.md`] =
      `${hChecking}\n\n${checkingBody.trim()}\n`;
  }
  if (ministryBody.trim()) {
    transclusions[`${ministryFile}.md`] =
      `${hMinistry}\n\n${ministryBody.trim()}\n`;
  }
  if (missionalBody.trim()) {
    transclusions[`${missionalFile}.md`] =
      `${hMissional}\n\n${missionalBody.trim()}\n`;
  }
  if (conclusionBody.trim()) {
    transclusions[`${conclusionFile}.md`] =
      `${hConclusion}\n\n${reflow(conclusionBody)}\n`;
  }

  const frameLines: string[] = [];
  for (const f of frames) {
    frameLines.push(`######### ${f.id}`);
    const img = images.get(f.id);
    if (img) frameLines.push(`![[${img}]]`);
    frameLines.push("", f.text, "");
  }

  const docTitle = extractDocTitle(text, language);
  const lines: string[] = [
    "---",
    `title: ${JSON.stringify(docTitle).slice(1, -1)}`,
    `subtitle: ${JSON.stringify(subtitle).slice(1, -1)}`,
    "layout: obs_story",
    `story_num: ${storyNum}`,
    "---",
    hIntro,
    "",
    hKeyIdea,
    keyIdea,
    "",
    hCreedal,
    creedalVerse,
    "",
    hMeta,
    metanarrative,
    "",
    hStory,
    "",
    ...frameLines,
  ];

  if (bibleSource) {
    lines.push(`*Sebuah Cerita Alkitab dari: ${bibleSource}*`, "");
  }

  // Community Study is story-unique → embed (not a shared TX)
  if (communityMd.trim()) {
    lines.push(communityMd.trim(), "");
  }

  lines.push(
    hBiblical,
    biblicalIntro(text, located, language),
    "",
    observationMd.trim(),
    "",
    translationMd.trim(),
    "",
    hDialogue,
    theologicalIntro(text, located, language),
    "",
    discourseMd.trim(),
    "",
    theologicalMd.trim(),
    "",
  );

  if (transclusions[`${draftingFile}.md`]) {
    lines.push(`![[${draftingFile}]]`, "");
  }

  lines.push(
    hReflection,
    personalReflectionIntro(text, located, language),
    "",
    journalMd.trim(),
    "",
  );

  if (transclusions[`${checkingFile}.md`]) {
    lines.push(`![[${checkingFile}]]`, "");
  }
  if (transclusions[`${ministryFile}.md`]) {
    lines.push(`![[${ministryFile}]]`, "");
  }
  if (transclusions[`${missionalFile}.md`]) {
    lines.push(`![[${missionalFile}]]`, "");
  }
  if (transclusions[`${conclusionFile}.md`]) {
    lines.push(`![[${conclusionFile}]]`, "");
  }

  const storyMarkdown = stripSectionIdsFromHeadings(
    lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n",
  );
  const cleanedTx: Record<string, string> = {};
  for (const [file, body] of Object.entries(transclusions)) {
    cleanedTx[file] = stripSectionIdsFromHeadings(body);
  }

  return {
    storyMarkdown,
    transclusions: cleanedTx,
    subtitle,
    storyNum,
    language,
  };
}
