/**
 * Verify that Indonesian PDF / plain-MD source text is retained in the
 * generated Door43 repository (no content lost in convert → export).
 *
 * Method:
 * 1. Normalize source + repo markdown (whitespace, punctuation, section ids,
 *    heading marks, frame markers).
 * 2. Slide fixed-size word windows over each story's source.
 * 3. Require each window as a substring of the concatenated repo corpus.
 *
 * Usage:
 *   npm run check:coverage
 *   npm run check:coverage -- --story=3
 *   npm run check:coverage -- --repo=exports/id_obs_tf --min=0.97
 *   npm run check:coverage -- --window=10 --step=5 --json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripYamlFrontmatter } from "../src/content/pdfToObsTfMd.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THIS_FILE = fileURLToPath(import.meta.url);

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readFrontmatterFields(text: string): {
  title?: string;
  subtitle?: string;
  body: string;
} {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---")) {
    return { body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { body: raw };
  const fm = raw.slice(3, end);
  const body = raw.slice(end + 4).replace(/^\s*\n/, "");
  // Skip plain-pdf-to-md tooling frontmatter (not PDF body content)
  if (
    /^conversion:\s*/im.test(fm) ||
    /^source:\s*.*\.pdf\s*$/im.test(fm) ||
    /^title:\s*OBS\s+\d+/im.test(fm)
  ) {
    return { body };
  }
  const title = /^title:\s*(.+)$/m.exec(fm)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const subtitle = /^subtitle:\s*(.+)$/m
    .exec(fm)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  return { title, subtitle, body };
}

/** Normalize for coverage compare — keep letters/numbers, drop markup noise. */
export function normalizeForCoverage(text: string): string {
  const { title, subtitle, body } = readFrontmatterFields(text);
  // Keep YAML title/subtitle — dest stories store them only in frontmatter
  let t = [title, subtitle, body].filter(Boolean).join("\n");
  // Drop wiki embeds / HTML comments / image refs
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  t = t.replace(/!\[\[[^\]]+\]\]/g, " ");
  t = t.replace(/<!--[\s\S]*?-->/g, " ");
  // Soft-wrapped frame refs / hyphens: "01-\n05", "ke- 5", "saudara- saudaranya"
  t = t.replace(/(\d{2})-\s+(\d{2})/g, "$1-$2");
  t = t.replace(/([A-Za-zÀ-ÿ])-\s+([A-Za-zÀ-ÿ])/g, "$1-$2");
  t = t.replace(/(ke)-\s+(\d)/gi, "$1-$2");
  // PDF page numbers on their own lines / trailing at EOL
  t = t.replace(/^\s*\d{1,3}\s*$/gm, " ");
  t = t.replace(/\s+\d{1,3}\s*$/gm, "");
  // Mid-paragraph list numbers before questions (community / observation)
  t = t.replace(
    /\s+\d{1,2}\.?\s+(?=(?:bagaimana|apa|apakah|mengapa|siapa|siapakah|ke mana|di mana|dari|berapa)\b)/gi,
    " ",
  );
  // Frame markers → bare ids (source **01-01** / dest ######### 01-01)
  t = t.replace(/#{5,9}\s*(\d{2}-\d{2})\b/g, " $1 ");
  t = t.replace(/\*\*(\d{2}-\d{2})\*\*/g, " $1 ");
  // Heading marks + PDF section ids (0–7 / N.N) before titles — before
  // punctuation strip so "0.4" is not split into "0 4".
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^(?:[0-7](?:\.\d+)?)\s+/gm, "");
  // Bold / italic / bullets
  t = t.replace(/\*\*?|__?|`+/g, " ");
  t = t.replace(/^[-*+]\s+/gm, " ");
  t = t.replace(/^\d+\.\s+/gm, " ");
  // Unify punctuation / whitespace
  t = t
    .toLowerCase()
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[—–‐‑]/g, "-")
    .replace(/[^\p{L}\p{N}\s'"-]/gu, " ")
    // Re-join any frame ids / soft-wrapped hyphens split by the punct pass
    .replace(/(\d{2})\s*-\s*(\d{2})/g, "$1-$2")
    .replace(/([A-Za-zÀ-ÿ])\s*-\s+([A-Za-zÀ-ÿ])/g, "$1-$2")
    .replace(/(ke)\s*-\s+(\d)/gi, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

/**
 * Split source into section-sized chunks so windows do not span
 * title → intro → community boundaries (those are not contiguous in the repo).
 */
export function splitSourceChunks(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const body = stripYamlFrontmatter(raw);
  const parts = body.split(
    /(?=^#{1,6}\s+|^[0-7](?:\.\d+)?\s+\S|\*\*\d{2}-\d{2}\*\*|#{5,9}\s*\d{2}-\d{2}\b)/m,
  );
  const chunks = parts.map((p) => p.trim()).filter((p) => p.length >= 40);
  // Also keep a chunk for top matter (title/subtitle) before first section
  const top = readFrontmatterFields(raw);
  const topText = [top.title, top.subtitle].filter(Boolean).join("\n");
  if (topText.trim().length >= 8) chunks.unshift(topText);
  // Leading H1/H2 before section 0
  const lead = body.split(/^#{1,6}\s+[0-7]/m)[0]?.trim();
  if (lead && lead.length >= 8) {
    chunks.unshift(lead);
  }
  return chunks.length ? chunks : [body];
}

export function wordWindows(
  normalized: string,
  windowSize: number,
  step: number,
): string[] {
  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= windowSize) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i + windowSize <= words.length; i += step) {
    out.push(words.slice(i, i + windowSize).join(" "));
  }
  // Always include a final window that reaches the end
  const lastStart = Math.max(0, words.length - windowSize);
  if (lastStart % step !== 0) {
    out.push(words.slice(lastStart).join(" "));
  }
  return out;
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === ".git") continue;
        walk(p);
      } else if (name.endsWith(".md")) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort();
}

const SKIP_REPO_FILES =
  /(?:^|[/\\])(?:LICENSE|README|EXPORT_META|manifest)\.md$/i;

function loadRepoCorpus(repoDir: string): {
  corpus: string;
  files: string[];
  chars: number;
} {
  const files = listMarkdownFiles(repoDir).filter((f) => !SKIP_REPO_FILES.test(f));
  const parts: string[] = [];
  for (const f of files) {
    parts.push(normalizeForCoverage(readFileSync(f, "utf8")));
  }
  const corpus = parts.join(" ");
  return { corpus, files, chars: corpus.length };
}

function loadStorySource(storyNum: number): {
  path: string;
  kind: "plain-md" | "txt";
  text: string;
} | null {
  const plain = path.join(
    ROOT,
    "exports",
    "pdf-plain-md",
    `OBS_${storyNum}_Indonesia.plain.md`,
  );
  if (existsSync(plain)) {
    return {
      path: plain,
      kind: "plain-md",
      text: readFileSync(plain, "utf8"),
    };
  }
  const txt = path.join(
    ROOT,
    "data",
    "indonesian-text",
    `${String(storyNum).padStart(2, "0")}.txt`,
  );
  if (existsSync(txt)) {
    return { path: txt, kind: "txt", text: readFileSync(txt, "utf8") };
  }
  return null;
}

function discoverStories(): number[] {
  const nums = new Set<number>();
  const plainDir = path.join(ROOT, "exports", "pdf-plain-md");
  if (existsSync(plainDir)) {
    for (const f of readdirSync(plainDir)) {
      const m = /^OBS_(\d+)_Indonesia\.plain\.md$/i.exec(f);
      if (m) nums.add(Number(m[1]));
    }
  }
  const txtDir = path.join(ROOT, "data", "indonesian-text");
  if (existsSync(txtDir)) {
    for (const f of readdirSync(txtDir)) {
      const m = /^(\d+)\.txt$/i.exec(f);
      if (m) nums.add(Number(m[1]));
    }
  }
  return [...nums].sort((a, b) => a - b);
}

export interface StoryCoverageResult {
  storyNum: number;
  sourcePath: string;
  sourceKind: "plain-md" | "txt";
  sourceWords: number;
  windowsTotal: number;
  windowsFound: number;
  windowsMissing: number;
  coverage: number;
  /** Sample of missing windows (normalized) for debugging */
  missingSamples: string[];
}

export interface CoverageReport {
  generatedAt: string;
  repoDir: string;
  repoFiles: number;
  repoCorpusChars: number;
  windowSize: number;
  step: number;
  minCoverage: number;
  stories: StoryCoverageResult[];
  overall: {
    windowsTotal: number;
    windowsFound: number;
    coverage: number;
    ok: boolean;
  };
}

function checkStory(
  storyNum: number,
  corpus: string,
  windowSize: number,
  step: number,
  sampleLimit: number,
): StoryCoverageResult | null {
  const src = loadStorySource(storyNum);
  if (!src) return null;
  const chunks = splitSourceChunks(src.text);
  const windows: string[] = [];
  let sourceWords = 0;
  for (const chunk of chunks) {
    const normalized = normalizeForCoverage(chunk);
    sourceWords += normalized.split(" ").filter(Boolean).length;
    windows.push(...wordWindows(normalized, windowSize, step));
  }
  // De-dupe identical windows
  const unique = [...new Set(windows)];
  const missing: string[] = [];
  let found = 0;
  for (const w of unique) {
    if (corpus.includes(w)) found++;
    else if (missing.length < sampleLimit) missing.push(w);
  }
  const total = unique.length || 1;
  return {
    storyNum,
    sourcePath: path.relative(ROOT, src.path).replace(/\\/g, "/"),
    sourceKind: src.kind,
    sourceWords,
    windowsTotal: unique.length,
    windowsFound: found,
    windowsMissing: unique.length - found,
    coverage: found / total,
    missingSamples: missing,
  };
}

function main(): void {
  const repoRel =
    argValue("--repo") || path.join("exports", "id_obs_tf");
  const repoDir = path.resolve(ROOT, repoRel);
  const windowSize = Number(argValue("--window") || "10");
  const step = Number(argValue("--step") || "5");
  const minCoverage = Number(argValue("--min") || "0.97");
  const sampleLimit = Number(argValue("--samples") || "8");
  const storyFilter = argValue("--story");
  const writeJson = hasFlag("--json") || !hasFlag("--no-json");

  if (!existsSync(repoDir)) {
    console.error(
      `Repo not found: ${repoDir}\nRun: npm run convert:id && npm run export:dcs -- --force`,
    );
    process.exit(1);
  }

  const { corpus, files, chars } = loadRepoCorpus(repoDir);
  if (!corpus.length) {
    console.error(`No markdown corpus in ${repoDir}`);
    process.exit(1);
  }

  let stories = discoverStories();
  if (storyFilter) {
    const n = Number(storyFilter);
    stories = stories.filter((s) => s === n);
    if (!stories.length) {
      console.error(`No source found for story ${storyFilter}`);
      process.exit(1);
    }
  }

  const results: StoryCoverageResult[] = [];
  for (const n of stories) {
    const r = checkStory(n, corpus, windowSize, step, sampleLimit);
    if (r) results.push(r);
  }

  let windowsTotal = 0;
  let windowsFound = 0;
  for (const r of results) {
    windowsTotal += r.windowsTotal;
    windowsFound += r.windowsFound;
  }
  const overallCoverage =
    windowsTotal > 0 ? windowsFound / windowsTotal : 1;
  const failing = results.filter((r) => r.coverage < minCoverage);
  const ok = failing.length === 0 && overallCoverage >= minCoverage;

  const report: CoverageReport = {
    generatedAt: new Date().toISOString(),
    repoDir: path.relative(ROOT, repoDir).replace(/\\/g, "/"),
    repoFiles: files.length,
    repoCorpusChars: chars,
    windowSize,
    step,
    minCoverage,
    stories: results,
    overall: {
      windowsTotal,
      windowsFound,
      coverage: overallCoverage,
      ok,
    },
  };

  console.log(`PDF → repo content coverage`);
  console.log(`  repo: ${report.repoDir} (${files.length} md files)`);
  console.log(
    `  windows: ${windowSize} words, step ${step}, min ${(minCoverage * 100).toFixed(1)}%`,
  );
  console.log("");
  for (const r of results) {
    const pct = (r.coverage * 100).toFixed(1);
    const mark = r.coverage >= minCoverage ? "OK" : "LOW";
    console.log(
      `  Story ${String(r.storyNum).padStart(2, "0")}: ${pct}%  (${r.windowsFound}/${r.windowsTotal} windows)  [${mark}]  ← ${r.sourceKind}`,
    );
    if (r.coverage < minCoverage && r.missingSamples.length) {
      for (const s of r.missingSamples.slice(0, 3)) {
        const preview = s.length > 100 ? `${s.slice(0, 100)}…` : s;
        console.log(`           missing: "${preview}"`);
      }
    }
  }
  console.log("");
  console.log(
    `  Overall: ${(overallCoverage * 100).toFixed(2)}%  (${windowsFound}/${windowsTotal})  ${ok ? "PASS" : "FAIL"}`,
  );

  if (writeJson) {
    const outDir = path.join(ROOT, "exports", "pdf-plain-md");
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "content-coverage-report.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(`  report: ${path.relative(ROOT, outPath).replace(/\\/g, "/")}`);
  }

  process.exit(ok ? 0 : 1);
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1]!)).href ===
    pathToFileURL(THIS_FILE).href;

if (invokedDirectly) {
  main();
}
