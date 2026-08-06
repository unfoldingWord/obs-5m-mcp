/**
 * Parser for OBS Theological Formation (en_obs_tf) story markdown.
 *
 * Layout per obs_story_N.md:
 *   YAML frontmatter → Introduction → Open Bible Story frames →
 *   Community Study transclusion → Movement 1–5 sections (some via ![[transclusions]])
 */

export interface ObsTfMeta {
  title: string;
  subtitle: string;
  storyNum: number;
}

export interface ObsTfIntro {
  keyIdea: string;
  creedalVerse: string;
  metanarrative: string;
}

export interface ObsTfFrame {
  id: string;
  index: number;
  imageRef: string | null;
  text: string;
}

export interface FrameQa {
  frameId: string;
  items: Array<{ question: string; answer: string }>;
}

export interface TranslationTermQa {
  frameId: string;
  terms: Array<{ term: string; guidance: string }>;
}

export interface DiscourseItem {
  question: string;
  answer: string;
  frameRefs: string[];
}

export interface TransclusionRef {
  raw: string;
  file: string;
  section: string | null;
}

export interface ObsTfMovement {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  markdown: string;
  observation?: FrameQa[];
  translation?: TranslationTermQa[];
  discourse?: DiscourseItem[];
  theological?: string[];
  /** Translation draft activity (movement 2); resolved from TX or inline. */
  drafting?: string | null;
  journal?: string[];
  /** Team/quality check activity (movement 3); resolved from TX or inline. */
  checking?: string | null;
}

export interface ParsedObsTfStory {
  meta: ObsTfMeta;
  intro: ObsTfIntro;
  frames: ObsTfFrame[];
  bibleSource: string | null;
  communityStudyRef: TransclusionRef | null;
  /** Inline ## Community Study block when no ![[…]] transclusion is present. */
  inlineCommunityStudy: string | null;
  /** Closing wrap-up (TX or inline); after the five movements. */
  conclusion: string | null;
  movements: ObsTfMovement[];
  transclusionRefs: TransclusionRef[];
  rawMarkdown: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const TRANSCLUDE_RE = /!\[\[([^\]]+)\]\]/g;
const FRAME_HEADER_RE = /^#{6,9}\s+(\d{2})-(\d{2})\s*$/gm;

export function obsTfStoryPath(storyNum: number): string {
  return `obs_story_${storyNum}.md`;
}

export function parseTransclusionRef(raw: string): TransclusionRef {
  const inner = raw.replace(/^!\[\[/, "").replace(/\]\]$/, "").trim();
  const hash = inner.indexOf("#");
  if (hash === -1) {
    return { raw, file: stripMdExt(inner), section: null };
  }
  return {
    raw,
    file: stripMdExt(inner.slice(0, hash).trim()),
    section: inner.slice(hash + 1).trim() || null,
  };
}

function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, "");
}

export function sliceMarkdownSection(
  md: string,
  heading: string,
): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, "im");
  const match = start.exec(md);
  if (!match || match.index === undefined) return null;
  const from = match.index + match[0].length;
  const rest = md.slice(from);
  const next = /^#{1,6}\s+/m.exec(rest);
  const body = (next ? rest.slice(0, next.index) : rest).trim();
  return body || null;
}

export function resolveTransclusion(
  ref: TransclusionRef,
  files: Map<string, string>,
): string | null {
  const content = files.get(ref.file) ?? files.get(`${ref.file}.md`);
  if (!content) return null;
  if (!ref.section) return content.trim();
  return sliceMarkdownSection(content, ref.section);
}

function parseFrontmatter(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const m = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return out;
}

function collectTransclusions(md: string): TransclusionRef[] {
  const refs: TransclusionRef[] = [];
  for (const m of md.matchAll(TRANSCLUDE_RE)) {
    refs.push(parseTransclusionRef(m[0]));
  }
  return refs;
}

function extractSection(
  md: string,
  startHeading: RegExp,
  endHeading?: RegExp,
): string {
  const start = startHeading.exec(md);
  if (!start || start.index === undefined) return "";
  const from = start.index;
  const after = md.slice(from);
  if (!endHeading) return after.trim();
  endHeading.lastIndex = 0;
  const end = endHeading.exec(after.slice(start[0].length));
  if (!end || end.index === undefined) return after.trim();
  return after.slice(0, start[0].length + end.index).trim();
}

/** Body text after a heading (excluding the heading line), until the next heading. */
function extractSectionBody(md: string, startHeading: RegExp): string {
  const start = startHeading.exec(md);
  if (!start || start.index === undefined) return "";
  const from = start.index + start[0].length;
  const rest = md.slice(from);
  const next = /^#{1,6}\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function parseFrames(storyBody: string): {
  frames: ObsTfFrame[];
  bibleSource: string | null;
} {
  const frames: ObsTfFrame[] = [];
  const matches = [...storyBody.matchAll(FRAME_HEADER_RE)];
  let bibleSource: string | null = null;
  const bibleMatch =
    /\*(?:A Bible story from|Sebuah [Cc]erita Alkitab dari):\s*([^*]+)\*/i.exec(
      storyBody,
    );
  if (bibleMatch) bibleSource = bibleMatch[1].trim();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : storyBody.length;
    let chunk = storyBody.slice(start, end).trim();
    chunk = chunk
      .replace(
        /\*(?:A Bible story from|Sebuah [Cc]erita Alkitab dari):[^*]+\*/i,
        "",
      )
      .trim();
    const img = /!\[\[([^\]]+)\]\]/.exec(chunk);
    const imageRef = img ? img[1] : null;
    const text = chunk
      .replace(/!\[\[[^\]]+\]\]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const index = Number.parseInt(m[2], 10);
    frames.push({
      id: `${m[1]}-${m[2]}`,
      index,
      imageRef,
      text,
    });
  }
  return { frames, bibleSource };
}

// English DCS headings, Indonesian titles (ids stripped), or legacy numbered ids.
const RE_OBS_HEADING =
  /^###\s+(?:Observation Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*Observasi|2\.1\b).*$/im;
const RE_TRANS_HEADING =
  /^###\s+(?:Translation Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*(?:Penerjemahan|terjemahan)|2\.2\b).*$/im;
const RE_DISCOURSE_HEADING =
  /^###\s+(?:Discourse Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s+Diskur(?:sus|us)|3\.1\b).*$/im;
const RE_THEOLOGICAL_HEADING =
  /^###\s+(?:Theological Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*Teologis|3\.2\b).*$/im;
const RE_JOURNAL_HEADING =
  /^###\s+(?:Journal Reflection|Refleksi Jurnal|4\.1\b).*$/im;
const RE_KEY_IDEA = /^###\s+(?:Key Idea|Pokok Pikiran Utama|0\.1\b).*$/im;
const RE_CREEDAL = /^###\s+(?:Creedal Verse|Ayat Pengakuan Iman|0\.2\b).*$/im;
const RE_METANARRATIVE =
  /^###\s+(?:Metanarrative Summary|Rangkuman Metanarasi|0\.3\b).*$/im;
const RE_STORY_START =
  /^###\s+(?:Open Bible Story:|Cerita Alkitab(?:\s+Terbuka)?:|0\.4\b).*$/im;
const RE_STORY_END =
  /^(?:##\s+(?:Biblical Interpretation|Penafsiran Alkitab|Interpretasi Alkitab|Community Study|Studi Komunitas|2\b|1\b)|!\[\[(?:community_study|obs-devotionals))/im;
const RE_M1 =
  /^##\s+(?:Biblical Interpretation|Penafsiran Alkitab|Interpretasi Alkitab|2\b).*$/im;
const RE_M2 =
  /^##\s+(?:Theological Dialogue|Dialog Teologis|Percakapan Teologis|3\b).*$/im;
const RE_M3 = /^##\s+(?:Personal Reflection|Refleksi Pribadi|4\b).*$/im;
/** Session parts often shared via TX; may be # or ## / ### when inlined. */
const RE_DRAFTING =
  /^#{1,3}\s+(?:Translation Draft|Naskah Awal Terjemahan)\b.*$/im;
const RE_CHECKING = /^#{1,3}\s+(?:Team Check|Pemeriksaan Tim)\b.*$/im;
const RE_MINISTRY =
  /^#{1,2}\s+(?:Ministry Practice|Praktik Pelayanan)\b.*$/im;
const RE_MISSIONAL =
  /^#{1,2}\s+(?:Missional Outreach|Penjangkauan Misi)\b.*$/im;
const RE_CONCLUSION = /^#{1,2}\s+(?:Conclusion|Kesimpulan)\s*$/im;

/**
 * Slice from a heading through the next boundary heading (or EOF).
 * Returns the full slice including the start heading line.
 */
export function extractHeadingBlock(
  md: string,
  startHeading: RegExp,
  endHeadings: RegExp[] = [],
): string | null {
  const start = startHeading.exec(md);
  if (!start || start.index === undefined) return null;
  const from = start.index;
  const afterStart = md.slice(from + start[0].length);
  let endOffset = afterStart.length;
  for (const endRe of endHeadings) {
    const flags = endRe.flags.includes("g")
      ? endRe.flags
      : `${endRe.flags}g`;
    const re = new RegExp(endRe.source, flags);
    re.lastIndex = 0;
    const end = re.exec(afterStart);
    if (end?.index !== undefined && end.index < endOffset) {
      endOffset = end.index;
    }
  }
  const block = (start[0] + afterStart.slice(0, endOffset)).trim();
  return block || null;
}

function fallbackTxBody(
  files: Map<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const body = files.get(key) ?? files.get(`${key}.md`);
    if (body?.trim()) return body.trim();
  }
  return null;
}

function parseObservation(md: string): FrameQa[] {
  const section = extractSection(md, RE_OBS_HEADING, /^###\s+/m);
  if (!section) return [];
  return parseFrameQaBlocks(section, /^####\s+(\d{2}-\d{2})\s*$/gm);
}

function parseFrameQaBlocks(section: string, headerRe: RegExp): FrameQa[] {
  const headers = [...section.matchAll(headerRe)];
  const out: FrameQa[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const from = h.index! + h[0].length;
    const to = i + 1 < headers.length ? headers[i + 1].index! : section.length;
    const body = section.slice(from, to).trim();
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items: Array<{ question: string; answer: string }> = [];
    for (let j = 0; j < lines.length; j += 2) {
      const q = lines[j];
      const a = lines[j + 1] ?? "";
      if (q) items.push({ question: q, answer: a });
    }
    out.push({ frameId: h[1], items });
  }
  return out;
}

function parseTranslation(md: string): TranslationTermQa[] {
  const section = extractSection(md, RE_TRANS_HEADING, /^##\s+/m);
  if (!section) return [];
  const headers = [...section.matchAll(/^####\s+(\d{2}-\d{2})\s*$/gm)];
  const out: TranslationTermQa[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const from = h.index! + h[0].length;
    const to = i + 1 < headers.length ? headers[i + 1].index! : section.length;
    const body = section.slice(from, to).trim();
    const terms: Array<{ term: string; guidance: string }> = [];
    const termBlocks = body.split(/(?=^\*\*[^*]+\*\*)/m).filter(Boolean);
    for (const block of termBlocks) {
      const tm = /^\*\*([^*]+)\*\*\s*(.*)$/s.exec(block.trim());
      if (!tm) continue;
      terms.push({ term: tm[1].trim(), guidance: tm[2].trim() });
    }
    out.push({ frameId: h[1], terms });
  }
  return out;
}

function parseDiscourse(md: string): DiscourseItem[] {
  const section = extractSection(md, RE_DISCOURSE_HEADING, /^###\s+/m);
  if (!section) return [];
  const items: DiscourseItem[] = [];
  const headers = [...section.matchAll(/^#####\s+(.+?)\s*$/gm)];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const from = h.index! + h[0].length;
    const to = i + 1 < headers.length ? headers[i + 1].index! : section.length;
    const answer = section.slice(from, to).trim();
    const qLine = h[1].trim();
    const frameRefs = [...qLine.matchAll(/\((\d{2}-\d{2}(?:,\s*\d{2}-\d{2})*)\)/g)]
      .flatMap((m) => m[1].split(/,\s*/));
    items.push({
      question: qLine.replace(/\s*\([^)]*\)\s*$/, "").trim(),
      answer,
      frameRefs,
    });
  }
  return items;
}

function parseNumberedList(md: string, heading: RegExp): string[] {
  const section = extractSection(md, heading, /^##\s+|^###\s+|^!\[\[/m);
  if (!section) return [];
  return [...section.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
}

function movementTitle(id: number, headingLine: string): string {
  const cleaned = headingLine.replace(/^##\s+/, "").trim();
  return cleaned || `Movement ${id}`;
}

/**
 * Expand ![[file]] and ![[file#Section]] in markdown using a file map.
 */
export function expandTransclusions(
  md: string,
  files: Map<string, string>,
): string {
  return md.replace(TRANSCLUDE_RE, (raw) => {
    const ref = parseTransclusionRef(raw);
    const resolved = resolveTransclusion(ref, files);
    return resolved ?? raw;
  });
}

export function parseObsTfStoryMarkdown(md: string): ParsedObsTfStory {
  const fmMatch = FRONTMATTER_RE.exec(md);
  const fm = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
  const body = fmMatch ? md.slice(fmMatch[0].length) : md;

  const storyNum = Number.parseInt(fm.story_num ?? "0", 10) || 0;
  const meta: ObsTfMeta = {
    title: fm.title || "Open Bible Stories",
    subtitle: fm.subtitle || "",
    storyNum,
  };

  const keyIdea =
    sliceMarkdownSection(body, "Key Idea") ??
    extractSectionBody(body, RE_KEY_IDEA);
  const creedalVerse =
    sliceMarkdownSection(body, "Creedal Verse") ??
    extractSectionBody(body, RE_CREEDAL);
  const metanarrative =
    sliceMarkdownSection(body, "Metanarrative Summary") ??
    extractSectionBody(body, RE_METANARRATIVE);

  const storySection = extractSection(body, RE_STORY_START, RE_STORY_END);
  const { frames, bibleSource } = parseFrames(storySection);

  const transclusionRefs = collectTransclusions(body);
  const communityStudyRef =
    transclusionRefs.find((r) =>
      /Community Study|Studi Komunitas/i.test(r.section ?? "") ||
      /obs-devotionals/i.test(r.file) ||
      /community_study/i.test(r.file),
    ) ?? null;

  const inlineCommunityStudy = communityStudyRef
    ? null
    : extractSection(
        body,
        /^#{1,2}\s+(?:Community Study|Studi Komunitas|\d+\s+Studi Komunitas)/im,
        /^#{1,2}\s+(?!(?:Community Study|Studi Komunitas|\d+\s+Studi Komunitas))/im,
      ) || null;

  const m1Block = extractSection(body, RE_M1, RE_M2);
  const m2Block = extractSection(body, RE_M2, RE_M3);
  const m3Block = extractSection(body, RE_M3);

  const movements: ObsTfMovement[] = [
    {
      id: 1,
      title: movementTitle(
        1,
        RE_M1.exec(body)?.[0] ?? "Biblical Interpretation",
      ),
      markdown: m1Block,
      observation: parseObservation(m1Block),
      translation: parseTranslation(m1Block),
    },
    {
      id: 2,
      title: movementTitle(
        2,
        RE_M2.exec(body)?.[0] ?? "Theological Dialogue",
      ),
      markdown: m2Block,
      discourse: parseDiscourse(m2Block),
      theological: parseNumberedList(m2Block, RE_THEOLOGICAL_HEADING),
    },
    {
      id: 3,
      title: movementTitle(
        3,
        RE_M3.exec(body)?.[0] ?? "Personal Reflection",
      ),
      markdown: m3Block,
      journal: parseNumberedList(m3Block, RE_JOURNAL_HEADING),
    },
    {
      id: 4,
      title: "Ministry Practice",
      markdown: transclusionRefs.find((r) => r.file === "movement_4")?.raw ?? "",
    },
    {
      id: 5,
      title: "Missional Outreach",
      markdown: transclusionRefs.find((r) => r.file === "movement_5")?.raw ?? "",
    },
  ];

  return {
    meta,
    intro: { keyIdea, creedalVerse, metanarrative },
    frames,
    bibleSource,
    communityStudyRef,
    inlineCommunityStudy: inlineCommunityStudy?.trim()
      ? inlineCommunityStudy.trim()
      : null,
    conclusion: null,
    movements,
    transclusionRefs,
    rawMarkdown: md,
  };
}

/**
 * After loading transclusion files, expand ![[…]] and promote drafting /
 * checking / ministry / missional / conclusion into first-class fields so
 * agents never need to follow packaging (shared TX vs story-inline).
 */
export function applyTransclusionsToStory(
  story: ParsedObsTfStory,
  files: Map<string, string>,
): ParsedObsTfStory {
  const fullExpanded = expandTransclusions(story.rawMarkdown, files);

  const drafting =
    extractHeadingBlock(fullExpanded, RE_DRAFTING, [
      RE_M3,
      RE_CHECKING,
      RE_MINISTRY,
      RE_MISSIONAL,
      RE_CONCLUSION,
    ]) ?? fallbackTxBody(files, "movement_2_drafting");

  const checking =
    extractHeadingBlock(fullExpanded, RE_CHECKING, [
      RE_MINISTRY,
      RE_MISSIONAL,
      RE_CONCLUSION,
    ]) ?? fallbackTxBody(files, "movement_3_checking");

  const ministry =
    extractHeadingBlock(fullExpanded, RE_MINISTRY, [
      RE_MISSIONAL,
      RE_CONCLUSION,
    ]) ??
    (() => {
      const ref = story.transclusionRefs.find((r) => r.file === "movement_4");
      return ref ? resolveTransclusion(ref, files) : null;
    })() ??
    fallbackTxBody(files, "movement_4");

  const missional =
    extractHeadingBlock(fullExpanded, RE_MISSIONAL, [RE_CONCLUSION]) ??
    (() => {
      const ref = story.transclusionRefs.find((r) => r.file === "movement_5");
      return ref ? resolveTransclusion(ref, files) : null;
    })() ??
    fallbackTxBody(files, "movement_5");

  const conclusion =
    extractHeadingBlock(fullExpanded, RE_CONCLUSION) ??
    (() => {
      const ref = story.transclusionRefs.find((r) => r.file === "conclusion");
      return ref ? resolveTransclusion(ref, files) : null;
    })() ??
    fallbackTxBody(files, "conclusion");

  // Keep movement 1–3 bodies focused: strip later session parts from M3 blob.
  const m1 = story.movements.find((m) => m.id === 1)!;
  const m2 = story.movements.find((m) => m.id === 2)!;
  const m3 = story.movements.find((m) => m.id === 3)!;

  let m2Md = expandTransclusions(m2.markdown, files);
  if (drafting) {
    const cut = RE_DRAFTING.exec(m2Md);
    if (cut?.index !== undefined) m2Md = m2Md.slice(0, cut.index).trim();
  }

  let m3Md = expandTransclusions(m3.markdown, files);
  for (const re of [RE_CHECKING, RE_MINISTRY, RE_MISSIONAL, RE_CONCLUSION]) {
    const cut = re.exec(m3Md);
    if (cut?.index !== undefined) {
      m3Md = m3Md.slice(0, cut.index).trim();
      break;
    }
  }

  const movements: ObsTfMovement[] = [
    {
      ...m1,
      markdown: expandTransclusions(m1.markdown, files),
    },
    {
      ...m2,
      markdown: m2Md,
      drafting: drafting?.trim() || null,
    },
    {
      ...m3,
      markdown: m3Md,
      checking: checking?.trim() || null,
      journal: m3.journal?.length
        ? m3.journal
        : parseNumberedList(m3Md, RE_JOURNAL_HEADING),
    },
    {
      id: 4,
      title: "Ministry Practice",
      markdown: ministry?.trim() || "",
    },
    {
      id: 5,
      title: "Missional Outreach",
      markdown: missional?.trim() || "",
    },
  ];

  return {
    ...story,
    conclusion: conclusion?.trim() || null,
    movements,
  };
}
