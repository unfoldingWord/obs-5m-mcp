/**
 * Compare Indonesian-PDF→English plain MD with DCS en_obs_tf story markdown.
 *
 *   npx tsx scripts/compare-plain-en-to-dcs.ts --story=1
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–-]+/g, "-")
    .replace(/[^\p{L}\p{N}\s'"]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((t) => t.length > 2));
}

/** Jaccard similarity on word tokens */
function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function extractHeadings(md: string): string[] {
  return md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^#{1,6}\s+/, "").trim());
}

function extractFramesPlain(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\*\*(\d{2}-\d{2})\*\*\s*\n+([\s\S]*?)(?=\n\*\*\d{2}-\d{2}\*\*|\n## |\n### |\n---|\n*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function extractFramesDcs(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re =
    /#{5,}\s*(\d{2}-\d{2})\s*\n(?:!\[\[[^\]]+\]\]\s*\n)?([\s\S]*?)(?=\n#{5,}\s*\d{2}-\d{2}|\n## |\n### |\n\*A Bible|\n<!--|\n*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    out[m[1]!] = m[2]!.replace(/!\[\[[^\]]+\]\]/g, "").trim();
  }
  return out;
}

function sectionBetween(md: string, start: RegExp, end?: RegExp): string {
  const sm = start.exec(md);
  if (!sm || sm.index === undefined) return "";
  const from = sm.index + sm[0].length;
  if (!end) return md.slice(from).trim();
  const rest = md.slice(from);
  const em = end.exec(rest);
  return (em && em.index !== undefined ? rest.slice(0, em.index) : rest).trim();
}

function firstStoryFramesOnly(frames: Record<string, string>): Record<string, string> {
  // Plain file repeats frame IDs in observation/translation; take first occurrence only
  // extractFramesPlain already takes sequential; for plain we re-extract from story section only
  return frames;
}

type PairResult = {
  id: string;
  similarity: number;
  status: "match" | "close" | "divergent" | "missing_in_plain" | "missing_in_dcs";
  plainPreview: string;
  dcsPreview: string;
};

function compareFrameMaps(
  plain: Record<string, string>,
  dcs: Record<string, string>,
): PairResult[] {
  const ids = [...new Set([...Object.keys(plain), ...Object.keys(dcs)])].sort();
  return ids.map((id) => {
    const p = plain[id];
    const d = dcs[id];
    if (!p && d) {
      return {
        id,
        similarity: 0,
        status: "missing_in_plain",
        plainPreview: "",
        dcsPreview: d.slice(0, 120),
      };
    }
    if (p && !d) {
      return {
        id,
        similarity: 0,
        status: "missing_in_dcs",
        plainPreview: p.slice(0, 120),
        dcsPreview: "",
      };
    }
    const sim = similarity(p!, d!);
    const status =
      sim >= 0.85 ? "match" : sim >= 0.55 ? "close" : "divergent";
    return {
      id,
      similarity: Math.round(sim * 1000) / 1000,
      status,
      plainPreview: p!.slice(0, 140).replace(/\n/g, " "),
      dcsPreview: d!.slice(0, 140).replace(/\n/g, " "),
    };
  });
}

function main() {
  const story = Number.parseInt(argValue("--story") ?? "1", 10);
  const plainPath = path.join(
    ROOT,
    "exports/pdf-plain-md",
    `OBS_${story}_Indonesia.plain.en.md`,
  );
  const dcsPath = path.join(
    ROOT,
    "exports/pdf-plain-md",
    `en_obs_tf_story_${story}.dcs.md`,
  );

  if (!existsSync(plainPath)) {
    console.error("Missing plain EN:", plainPath);
    process.exit(1);
  }
  if (!existsSync(dcsPath)) {
    console.error("Missing DCS EN:", dcsPath);
    process.exit(1);
  }

  const plainMd = readFileSync(plainPath, "utf8");
  const dcsMd = readFileSync(dcsPath, "utf8");

  // Story body only (before Community Study / Biblical Interpretation)
  const plainStory = sectionBetween(
    plainMd,
    /### 0\.4[^\n]*\n/,
    /^## 1 /m,
  );
  const dcsStory = sectionBetween(
    dcsMd,
    /### Open Bible Story:[^\n]*\n/,
    /^## Biblical Interpretation/m,
  );

  const plainFrames = extractFramesPlain(plainStory);
  const dcsFrames = extractFramesDcs(dcsStory);
  const frameCompare = compareFrameMaps(
    firstStoryFramesOnly(plainFrames),
    dcsFrames,
  );

  const plainObs = sectionBetween(
    plainMd,
    /### 2\.1[^\n]*\n/,
    /### 2\.2/,
  );
  const dcsObs = sectionBetween(
    dcsMd,
    /### Observation Questions\n/,
    /### Translation Questions/,
  );

  const plainTq = sectionBetween(
    plainMd,
    /### 2\.2[^\n]*\n/,
    /^## 3 /m,
  );
  const dcsTq = sectionBetween(
    dcsMd,
    /### Translation Questions\n/,
    /^## Theological Dialogue/m,
  );

  const plainDiscourse = sectionBetween(
    plainMd,
    /### 3\.1[^\n]*\n/,
    /### 3\.2/,
  );
  const dcsDiscourse = sectionBetween(
    dcsMd,
    /### Discourse Questions\n/,
    /### Theological Questions/,
  );

  const plainTheo = sectionBetween(
    plainMd,
    /### 3\.2[^\n]*\n/,
    /### 3\.3/,
  );
  const dcsTheo = sectionBetween(
    dcsMd,
    /### Theological Questions\s*\n/,
    /^!\[\[movement_2/m,
  );

  const plainJournal = sectionBetween(
    plainMd,
    /### 4\.1[^\n]*\n/,
    /### 4\.2/,
  );
  const dcsJournal = sectionBetween(
    dcsMd,
    /### Journal Reflection\s*\n/,
    /^!\[\[movement_3/m,
  );

  const sectionSims = [
    {
      section: "Story frames (aggregate text)",
      similarity: similarity(
        Object.values(plainFrames).join(" "),
        Object.values(dcsFrames).join(" "),
      ),
    },
    {
      section: "Observation questions",
      similarity: similarity(plainObs, dcsObs),
    },
    {
      section: "Translation questions",
      similarity: similarity(plainTq, dcsTq),
    },
    {
      section: "Discourse questions",
      similarity: similarity(plainDiscourse, dcsDiscourse),
    },
    {
      section: "Theological questions",
      similarity: similarity(plainTheo, dcsTheo),
    },
    {
      section: "Journal reflection",
      similarity: similarity(plainJournal, dcsJournal),
    },
  ].map((s) => ({
    ...s,
    similarity: Math.round(s.similarity * 1000) / 1000,
  }));

  const plainHeadings = extractHeadings(plainMd);
  const dcsHeadings = extractHeadings(dcsMd);

  const structuralNotes = [
    {
      topic: "Document shape",
      plain:
        "Indonesian PDF outline (0–7 numbered sections), all content inline",
      dcs: "en_obs_tf layout with English movement headings + wiki transclusions",
    },
    {
      topic: "Community Study",
      plain: "Inline under ## 1 (full Indonesian-PDF content in English)",
      dcs: "Transclusion ![[obs-devotionals-unit-3#…]] — not expanded in story file",
    },
    {
      topic: "Story frames",
      plain: `**NN-NN** markers, no images (${Object.keys(plainFrames).length} frames in story section)`,
      dcs: `######### NN-NN + ![[imageN.jpeg]] (${Object.keys(dcsFrames).length} frames)`,
    },
    {
      topic: "Drafting / Checking / Ministry / Mission / Conclusion",
      plain: "Inline sections 3.3, 4.2, 5, 6, 7 (from Indonesian PDF)",
      dcs: "Transclusions movement_2_drafting, movement_3_checking, movement_4, movement_5, conclusion",
    },
    {
      topic: "Heading style",
      plain: plainHeadings.slice(0, 8).join(" · "),
      dcs: dcsHeadings.slice(0, 8).join(" · "),
    },
  ];

  const avgFrameSim =
    frameCompare.filter((f) => f.status !== "missing_in_plain" && f.status !== "missing_in_dcs")
      .reduce((s, f) => s + f.similarity, 0) /
    Math.max(
      1,
      frameCompare.filter(
        (f) => f.status !== "missing_in_plain" && f.status !== "missing_in_dcs",
      ).length,
    );

  const report = {
    generatedAt: new Date().toISOString(),
    story,
    sources: {
      plainEn: path.relative(ROOT, plainPath),
      dcsEn: path.relative(ROOT, dcsPath),
      dcsUrl: `https://git.door43.org/unfoldingWord/en_obs_tf/src/branch/master/obs_story_${story}.md`,
    },
    summary: {
      plainChars: plainMd.length,
      dcsChars: dcsMd.length,
      plainHeadings: plainHeadings.length,
      dcsHeadings: dcsHeadings.length,
      frameCountPlain: Object.keys(plainFrames).length,
      frameCountDcs: Object.keys(dcsFrames).length,
      avgFrameSimilarity: Math.round(avgFrameSim * 1000) / 1000,
      frameStatusCounts: frameCompare.reduce(
        (acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    structuralNotes,
    sectionSims,
    frames: frameCompare,
    plainHeadings,
    dcsHeadings,
  };

  const outDir = path.join(ROOT, "exports/pdf-plain-md");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `OBS_${story}_plain-en_vs_dcs.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Human-readable markdown report
  const mdLines: string[] = [
    `# Comparison: Plain EN (from ID PDF) vs DCS en_obs_tf — Story ${story}`,
    "",
    `- **Plain EN:** \`${report.sources.plainEn}\``,
    `- **DCS EN:** \`${report.sources.dcsEn}\``,
    `- **DCS URL:** ${report.sources.dcsUrl}`,
    "",
    "## Summary",
    "",
    `| Metric | Plain EN | DCS EN |`,
    `| --- | ---: | ---: |`,
    `| Characters | ${report.summary.plainChars} | ${report.summary.dcsChars} |`,
    `| Headings | ${report.summary.plainHeadings} | ${report.summary.dcsHeadings} |`,
    `| Story frames | ${report.summary.frameCountPlain} | ${report.summary.frameCountDcs} |`,
    `| Avg frame text similarity | ${Math.round(report.summary.avgFrameSimilarity * 100)}% | — |`,
    "",
    "### Frame status counts",
    "",
    ...Object.entries(report.summary.frameStatusCounts).map(
      ([k, v]) => `- **${k}:** ${v}`,
    ),
    "",
    "## Structural differences",
    "",
    ...structuralNotes.flatMap((n) => [
      `### ${n.topic}`,
      "",
      `- **Plain EN:** ${n.plain}`,
      `- **DCS EN:** ${n.dcs}`,
      "",
    ]),
    "## Section text similarity (token Jaccard)",
    "",
    "| Section | Similarity |",
    "| --- | ---: |",
    ...sectionSims.map(
      (s) => `| ${s.section} | ${Math.round(s.similarity * 100)}% |`,
    ),
    "",
    "## Per-frame story text",
    "",
    "| Frame | Similarity | Status |",
    "| --- | ---: | --- |",
    ...frameCompare.map(
      (f) =>
        `| ${f.id} | ${Math.round(f.similarity * 100)}% | ${f.status} |`,
    ),
    "",
    "### Notable divergent / close frames",
    "",
  ];

  for (const f of frameCompare.filter(
    (x) => x.status === "divergent" || x.status === "close",
  )) {
    mdLines.push(`#### ${f.id} (${Math.round(f.similarity * 100)}% — ${f.status})`);
    mdLines.push("");
    mdLines.push(`- **Plain:** ${f.plainPreview}`);
    mdLines.push(`- **DCS:** ${f.dcsPreview}`);
    mdLines.push("");
  }

  mdLines.push("## Heading inventories");
  mdLines.push("");
  mdLines.push("### Plain EN");
  mdLines.push("");
  for (const h of plainHeadings) mdLines.push(`- ${h}`);
  mdLines.push("");
  mdLines.push("### DCS EN");
  mdLines.push("");
  for (const h of dcsHeadings) mdLines.push(`- ${h}`);
  mdLines.push("");

  const mdPath = path.join(outDir, `OBS_${story}_plain-en_vs_dcs.md`);
  writeFileSync(mdPath, mdLines.join("\n"));

  console.log("Wrote", jsonPath);
  console.log("Wrote", mdPath);
  console.log(
    "Avg frame similarity:",
    Math.round(report.summary.avgFrameSimilarity * 100) + "%",
  );
  console.log("Section sims:", sectionSims);
}

main();
