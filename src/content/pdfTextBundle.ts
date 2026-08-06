/**
 * Build a StoryBundle-compatible structure from extracted self-hosted PDF text
 * when DCS has no OBS Theological Formation entry for the language.
 */

import type { ParsedObsTfStory, ObsTfFrame, ObsTfMovement } from "./obsTfParser.js";

const MOVEMENT_TITLES: Record<number, string> = {
  1: "Biblical Interpretation / Community Study",
  2: "Theological Dialogue (Observation & Translation)",
  3: "Personal Reflection / Theological Dialogue",
  4: "Ministry Practice",
  5: "Missional Outreach",
};

/** Pull intro fields from Indonesian (or similar) PDF plain text. */
export function parsePdfIntro(text: string): {
  keyIdea: string;
  creedalVerse: string;
  metanarrative: string;
  subtitle: string;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const subtitle =
    lines.find(
      (l, i) =>
        i > 0 &&
        l.length > 3 &&
        !/^Cerita Alkitab/i.test(l) &&
        !/^\d/.test(l),
    ) ?? "OBS Story";

  const section = (start: RegExp, end: RegExp): string => {
    const startIdx = text.search(start);
    if (startIdx < 0) return "";
    const after = text.slice(startIdx);
    const bodyStart = after.search(/\n/);
    const rest = bodyStart >= 0 ? after.slice(bodyStart + 1) : after;
    const endIdx = rest.search(end);
    return (endIdx >= 0 ? rest.slice(0, endIdx) : rest).trim();
  };

  return {
    subtitle,
    keyIdea: section(
      /0\.1\s+Pokok Pikiran Utama|Key Idea/i,
      /\n0\.2\b|\n0\.3\b|\n1\./i,
    ),
    creedalVerse: section(
      /0\.2\s+Ayat Pengakuan Iman|Credal Verse|Creedal Verse/i,
      /\n0\.3\b|\n0\.4\b|\n1\./i,
    ),
    metanarrative: section(
      /0\.3\s+Rangkuman Metanarasi|Metanarrative/i,
      /\n0\.4\b|\n1\./i,
    ),
  };
}

/** Extract OBS frame blocks like `02-01` … next frame or section. */
export function parsePdfFrames(text: string, storyNum: number): ObsTfFrame[] {
  const pad = String(storyNum).padStart(2, "0");
  const re = new RegExp(`^${pad}-(\\d{2})\\s*$`, "gm");
  const frames: ObsTfFrame[] = [];
  const matches = [...text.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const index = Number.parseInt(m[1], 10);
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    // Stop at movement section headers like "2.2 Pertanyaan"
    let body = text.slice(start, end).trim();
    const cut = body.search(/\n2\.\d|\n3\s|\n3\.\d|\n4\.\d/);
    if (cut > 0 && i === matches.length - 1) body = body.slice(0, cut).trim();
    // Skip duplicate frame ids from later movement sections (observation reuse)
    if (frames.some((f) => f.index === index)) continue;
    // Only take frames from the story narration block (before 2.1 Observasi)
    const obsIdx = text.search(/2\.1\s+Pertanyaan|Observation Questions/i);
    if (obsIdx >= 0 && (m.index ?? 0) > obsIdx) continue;
    frames.push({
      id: `${pad}-${String(index).padStart(2, "0")}`,
      index,
      imageRef: null,
      text: body,
    });
  }
  return frames;
}

/**
 * Split PDF text into coarse movement markdown chunks by Indonesian section cues.
 */
export function parsePdfMovements(text: string): ObsTfMovement[] {
  const markers: Array<{ id: 1 | 2 | 3 | 4 | 5; re: RegExp }> = [
    { id: 1, re: /\n1\.\d|\n1\s+Studi|Community Study/i },
    { id: 2, re: /\n2\.1\s+Pertanyaan-Pertanyaan Observasi|Observation Questions/i },
    { id: 3, re: /\n3\s+Dialog Teologis|Theological Dialogue/i },
    { id: 4, re: /\n4\.1\s+Refleksi Jurnal|Journal Reflection|Ministry Practice/i },
    { id: 5, re: /\n5\.|Missional|Misi\b/i },
  ];

  const starts: Array<{ id: 1 | 2 | 3 | 4 | 5; index: number }> = [];
  for (const m of markers) {
    const match = m.re.exec(text);
    if (match && match.index !== undefined) {
      starts.push({ id: m.id, index: match.index });
    }
  }
  starts.sort((a, b) => a.index - b.index);

  if (starts.length === 0) {
    return [
      {
        id: 1,
        title: MOVEMENT_TITLES[1],
        markdown: text,
      },
    ];
  }

  const movements: ObsTfMovement[] = [];
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const next = starts[i + 1];
    const markdown = text.slice(cur.index, next?.index ?? text.length).trim();
    movements.push({
      id: cur.id,
      title: MOVEMENT_TITLES[cur.id] ?? `Movement ${cur.id}`,
      markdown,
    });
  }
  return movements;
}

export function pdfTextToParsedStory(
  storyNum: number,
  text: string,
  titleHint?: string,
): ParsedObsTfStory {
  const intro = parsePdfIntro(text);
  return {
    meta: {
      title: "OBS + Theological Formation",
      subtitle: titleHint || intro.subtitle,
      storyNum,
    },
    intro: {
      keyIdea: intro.keyIdea,
      creedalVerse: intro.creedalVerse,
      metanarrative: intro.metanarrative,
    },
    frames: parsePdfFrames(text, storyNum),
    bibleSource: null,
    communityStudyRef: null,
    inlineCommunityStudy: null,
    conclusion: null,
    movements: parsePdfMovements(text),
    transclusionRefs: [],
    rawMarkdown: text,
  };
}
