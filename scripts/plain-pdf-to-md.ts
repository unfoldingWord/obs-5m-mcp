/**
 * PDF → markdown using PDF font size / font face cues (no OBS-TF restructuring).
 *
 * Usage:
 *   npx tsx scripts/plain-pdf-to-md.ts --story=1
 *   npx tsx scripts/plain-pdf-to-md.ts --pdf="path/to/file.pdf"
 *   npx tsx scripts/plain-pdf-to-md.ts --story=1 --plain
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Frag = {
  str: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  hasEOL: boolean;
};

type Line = {
  frags: Frag[];
  text: string;
  maxSize: number;
  y: number;
  page: number;
};

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function modeNumber(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
}

async function extractPlainText(pdfPath: string): Promise<{
  text: string;
  pages: number;
}> {
  const buf = readFileSync(pdfPath);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const result = await extractText(pdf, { mergePages: true });
  const raw = Array.isArray(result.text)
    ? result.text.join("\n")
    : String(result.text ?? "");
  return {
    text: raw.replace(/\r\n/g, "\n").trim() + "\n",
    pages: result.totalPages,
  };
}

async function extractFrags(pdfPath: string): Promise<{
  pages: number;
  pageFrags: Frag[][];
}> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const pageFrags: Frag[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const frags: Frag[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const item = raw as {
        str: string;
        transform: number[];
        fontName?: string;
        hasEOL?: boolean;
      };
      if (!item.str) continue;
      const t = item.transform;
      frags.push({
        str: item.str,
        fontSize: Math.round(Math.hypot(t[2], t[3]) * 10) / 10,
        fontName: item.fontName || "",
        x: t[4],
        y: t[5],
        hasEOL: Boolean(item.hasEOL),
      });
    }
    pageFrags.push(frags);
  }
  return { pages: doc.numPages, pageFrags };
}

function groupLines(page: number, frags: Frag[]): Line[] {
  const sorted = [...frags].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  let bucket: Frag[] = [];
  let curY: number | null = null;

  const flush = () => {
    if (!bucket.length) return;
    bucket.sort((a, b) => a.x - b.x);
    const text = bucket
      .map((f) => f.str)
      .join("")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (text) {
      lines.push({
        frags: bucket,
        text,
        maxSize: Math.max(...bucket.map((f) => f.fontSize)),
        y: curY ?? bucket[0]!.y,
        page,
      });
    }
    bucket = [];
  };

  for (const f of sorted) {
    if (curY === null || Math.abs(f.y - curY) <= 2.5) {
      bucket.push(f);
      if (curY === null) curY = f.y;
    } else {
      flush();
      bucket = [f];
      curY = f.y;
    }
  }
  flush();
  return lines;
}

/** PDF.js font IDs are page-local — detect per page. */
function headingFontsOnPage(frags: Frag[], bodySize: number): Set<string> {
  const fonts = new Set<string>();
  // Only fonts used at clear display sizes (avoids list/question faces)
  for (const f of frags) {
    if (f.fontSize >= bodySize + 3 && f.str.trim()) fonts.add(f.fontName);
  }
  return fonts;
}

function headingFontRatio(line: Line, headingFonts: Set<string>): number {
  let total = 0;
  let heading = 0;
  for (const f of line.frags) {
    const n = f.str.replace(/\s/g, "").length;
    total += n;
    if (headingFonts.has(f.fontName)) heading += n;
  }
  return total ? heading / total : 0;
}

/** Numbered section / subsection titles used in these manuals. */
function looksLikeSectionTitle(text: string): boolean {
  return (
    /^\d+\.\d+\b/.test(text) || // 0.1, 1.2, 3.3
    /^\d+\s+\S/.test(text) // 0 Pengantar, 1 Studi…, 2 Penafsiran…
  );
}

function isHeadingLine(
  line: Line,
  bodySize: number,
  headingFonts: Set<string>,
): boolean {
  // Numbered list items like "1. Apa yang…" are not headings
  if (/^\d+\.\s/.test(line.text) && !/^\d+\.\d+\b/.test(line.text)) {
    return false;
  }

  // Clear display sizes (titles / major sections)
  if (line.maxSize >= bodySize + 3) return true;

  // Slightly larger text only if it is a section title in a title face
  if (
    line.maxSize > bodySize + 0.5 &&
    looksLikeSectionTitle(line.text) &&
    headingFontRatio(line, headingFonts) >= 0.7
  ) {
    return true;
  }

  // Numbered section/subsection titles (font-independent)
  if (
    looksLikeSectionTitle(line.text) &&
    line.text.length <= 140 &&
    !/[.!?]$/.test(line.text)
  ) {
    return true;
  }

  // Short line entirely in a page title face
  if (
    headingFonts.size > 0 &&
    headingFontRatio(line, headingFonts) >= 0.95 &&
    line.text.length <= 80 &&
    !/[.!?]$/.test(line.text)
  ) {
    return true;
  }

  return false;
}

function headingLevel(size: number, bodySize: number, text: string): number {
  if (size <= bodySize + 0.5) return 3;
  if (size >= bodySize + 7) return 1; // ~18 when body is 10
  if (size >= bodySize + 4) return 2; // ~14–15
  // Top-level "1 Studi…", "2 Penafsiran…"
  if (/^\d+\s/.test(text) && !/^\d+\.\d+/.test(text)) return 2;
  return 3;
}

function formatBulletText(text: string): string {
  const body = text.replace(/^[•●▪‣]\s*/, "");
  const colon = body.indexOf(":");
  if (colon > 0 && colon <= 48) {
    return `**${body.slice(0, colon).trim()}:**${body.slice(colon + 1)}`;
  }
  return body;
}

function toMarkdown(pageFrags: Frag[][]): string {
  const all = pageFrags.flat().filter((f) => f.str.trim());
  if (!all.length) return "";
  const bodySize = modeNumber(all.map((f) => f.fontSize));

  const out: string[] = [];

  for (let p = 0; p < pageFrags.length; p++) {
    const frags = pageFrags[p]!;
    const headingFonts = headingFontsOnPage(frags, bodySize);
    const lines = groupLines(p + 1, frags);

    let i = 0;
    while (i < lines.length) {
      const line = lines[i]!;
      const text = line.text;

      if (/^\d{2}-\d{2}$/.test(text)) {
        out.push("");
        out.push(`**${text}**`);
        out.push("");
        i++;
        continue;
      }

      if (/^[•●▪‣]/.test(text)) {
        out.push(`- ${formatBulletText(text)}`);
        i++;
        continue;
      }

      if (isHeadingLine(line, bodySize, headingFonts)) {
        let combined = text;
        let size = line.maxSize;
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j]!;
          if (!isHeadingLine(next, bodySize, headingFonts)) break;
          if (Math.abs(next.maxSize - size) > 0.5) break;
          // New numbered heading at same level → stop
          if (looksLikeSectionTitle(next.text) && looksLikeSectionTitle(combined)) {
            break;
          }
          // Soft-wrapped title (ends with dash) or short non-numbered continuation
          const wrapped =
            /[—–-]$/.test(combined) ||
            (!looksLikeSectionTitle(next.text) && next.text.length <= 60);
          if (!wrapped) break;
          combined = `${combined.replace(/[—–-]$/, "—")} ${next.text}`.replace(
            /\s+/g,
            " ",
          );
          j++;
        }
        const level = headingLevel(size, bodySize, combined);
        out.push("");
        out.push(`${"#".repeat(level)} ${combined.trim()}`);
        out.push("");
        i = j;
        continue;
      }

      out.push(text);
      i++;
    }
  }

  return (
    out
      .join("\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

function loadCachedText(story: number): string | null {
  const txtPath = path.join(
    ROOT,
    "data",
    "indonesian-text",
    `${String(story).padStart(2, "0")}.txt`,
  );
  if (existsSync(txtPath)) {
    return readFileSync(txtPath, "utf8").replace(/\r\n/g, "\n").trim() + "\n";
  }
  const jsonPath = path.join(ROOT, "data", "indonesian-text.json");
  if (!existsSync(jsonPath)) return null;
  const pack = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    stories?: Record<string, string>;
  };
  const t = pack.stories?.[String(story)];
  return t ? t.replace(/\r\n/g, "\n").trim() + "\n" : null;
}

function defaultPdfPath(story: number): string {
  return path.join(
    ROOT,
    "data/incoming/extracted/PDF OBS Indonesia",
    `OBS ${story} (Indonesia).pdf`,
  );
}

async function main() {
  const storyArg = argValue("--story");
  const pdfArg = argValue("--pdf");
  const outArg = argValue("--out");
  const plain = process.argv.includes("--plain");
  const preferCache = process.argv.includes("--from-cache");

  let pdfPath: string | undefined;
  let storyNum = storyArg ? Number.parseInt(storyArg, 10) : undefined;

  if (pdfArg) {
    pdfPath = path.resolve(ROOT, pdfArg);
  } else if (storyNum !== undefined && Number.isFinite(storyNum)) {
    pdfPath = defaultPdfPath(storyNum);
  } else {
    storyNum = 1;
    pdfPath = defaultPdfPath(1);
  }

  if (storyNum === undefined || !Number.isFinite(storyNum)) {
    storyNum = Number.parseInt(/OBS\s+(\d+)/i.exec(pdfPath)?.[1] ?? "1", 10);
  }

  const outDir = path.join(ROOT, "exports", "pdf-plain-md");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.resolve(
    ROOT,
    outArg || path.join(outDir, `OBS_${storyNum}_Indonesia.plain.md`),
  );

  let body: string;
  let pages: number | undefined;
  let sourceLabel: string;
  let conversion: string;

  if (plain && preferCache) {
    const cached = loadCachedText(storyNum);
    if (!cached) {
      console.error("No cached text; omit --from-cache or provide --pdf");
      process.exit(1);
    }
    body = cached;
    sourceLabel = `OBS ${storyNum} (Indonesia).pdf (from prior extract)`;
    conversion = "plain-pdf-text";
  } else if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  } else if (plain) {
    console.log("Extracting plain text", pdfPath);
    const extracted = await extractPlainText(pdfPath);
    body = extracted.text;
    pages = extracted.pages;
    sourceLabel = path.basename(pdfPath);
    conversion = "plain-pdf-text";
  } else {
    console.log("Converting with formatting", pdfPath);
    const extracted = await extractFrags(pdfPath);
    body = toMarkdown(extracted.pageFrags);
    pages = extracted.pages;
    sourceLabel = path.basename(pdfPath);
    conversion = "pdf-font-aware-markdown";
  }

  const md = [
    "---",
    `title: OBS ${storyNum} (Indonesia)`,
    `source: ${sourceLabel}`,
    ...(pages !== undefined ? [`pages: ${pages}`] : []),
    `conversion: ${conversion}`,
    "---",
    "",
    body.replace(/\n+$/, "\n"),
  ].join("\n");

  writeFileSync(outPath, md, "utf8");
  console.log(`Wrote ${outPath} (${md.length} chars)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
