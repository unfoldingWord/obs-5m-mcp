/**
 * Ingest Indonesian OBS Five Movements PDFs into R2, extract plain text, and refresh manifests.
 *
 * Usage:
 *   1. Place PDF files (or unpack a zip) under data/incoming/
 *   2. Naming: `OBS 1 (Indonesia).pdf`, `01-Title.pdf`, `obs_story_1.pdf`
 *   3. Dry-run: npm run ingest:id -- --dry-run
 *   4. Upload:  npm run ingest:id   (wrangler auth + R2 bucket)
 *   5. Local R2 for wrangler dev: npm run ingest:id -- --local
 *   6. Text-only (no R2): npm run ingest:id -- --text-only
 *   7. Convert text → en_obs_tf MD: npm run convert:id
 */

import { readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INCOMING = path.join(ROOT, "data", "incoming");
const MANIFEST_PATH = path.join(ROOT, "data", "indonesian-manifest.json");
const TEXT_JSON_PATH = path.join(ROOT, "data", "indonesian-text.json");
const TEXT_DIR = path.join(ROOT, "data", "indonesian-text");
const BUCKET = "obs-5m-mcp-assets";

interface StoryEntry {
  story: number;
  title: string;
  r2Key: string;
  textR2Key: string;
  filename: string;
}

/** Match "OBS 12 (Indonesia).pdf", "obs_story_1.pdf", "01-foo.pdf" */
function parseStoryNum(filename: string): number | null {
  const base = path.basename(filename);
  const obs = /^OBS\s+(\d{1,2})\b/i.exec(base);
  if (obs) {
    const n = Number.parseInt(obs[1], 10);
    return n >= 1 && n <= 50 ? n : null;
  }
  const generic =
    /(?:^|[^\d])(?:obs[_-]?story[_-]?)?0*(\d{1,2})(?:[_-\s.]|$)/i.exec(base);
  if (!generic) return null;
  const n = Number.parseInt(generic[1], 10);
  return n >= 1 && n <= 50 ? n : null;
}

function titleFromFilename(filename: string, story: number): string {
  const base = path.basename(filename, path.extname(filename));
  if (/^OBS\s+\d+/i.test(base)) {
    return `OBS ${story} (Indonesia)`;
  }
  const cleaned = base
    .replace(/obs[_-]?story[_-]?\d+/i, "")
    .replace(/^\d+[_-\s]*/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return cleaned || `OBS Story ${story}`;
}

function scoreCandidate(file: string): number {
  const base = path.basename(file).toLowerCase();
  let score = 0;
  if (base.includes("no pictures")) score -= 10;
  if (/^obs\s+\d+/i.test(path.basename(file))) score += 5;
  return score;
}

async function walkPdfs(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkPdfs(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      out.push(full);
    }
  }
  return out;
}

async function collectPdfs(): Promise<string[]> {
  await mkdir(INCOMING, { recursive: true });
  return walkPdfs(INCOMING);
}

async function extractPdfText(file: string): Promise<string> {
  const buf = readFileSync(file);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const result = await extractText(pdf, { mergePages: true });
  const raw = result.text as string | string[] | undefined;
  const text = Array.isArray(raw)
    ? raw.join("\n")
    : typeof raw === "string"
      ? raw
      : "";
  return text.replace(/\r\n/g, "\n").trim() + "\n";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const local = process.argv.includes("--local");
  const textOnly = process.argv.includes("--text-only");
  const pdfs = await collectPdfs();
  if (pdfs.length === 0) {
    console.error(
      `No PDFs found under ${INCOMING}. Unpack the Indonesian zip there and re-run.`,
    );
    process.exit(1);
  }

  // Prefer illustrated OBS N files over "No Pictures" duplicates
  const best = new Map<number, string>();
  const bestScore = new Map<number, number>();
  for (const file of pdfs) {
    const story = parseStoryNum(file);
    if (story === null) {
      console.warn(`Skipping (cannot parse story number): ${file}`);
      continue;
    }
    const score = scoreCandidate(file);
    if (!best.has(story) || score > (bestScore.get(story) ?? -Infinity)) {
      best.set(story, file);
      bestScore.set(story, score);
    }
  }

  await mkdir(TEXT_DIR, { recursive: true });
  const stories: StoryEntry[] = [];
  const textStories: Record<string, string> = {};

  for (const story of [...best.keys()].sort((a, b) => a - b)) {
    const file = best.get(story)!;
    const filename = path.basename(file);
    const r2Key = `id/obs-tf/${String(story).padStart(2, "0")}.pdf`;
    const textR2Key = `id/obs-tf/${String(story).padStart(2, "0")}.txt`;
    stories.push({
      story,
      title: titleFromFilename(filename, story),
      r2Key,
      textR2Key,
      filename,
    });

    console.log(`Extracting text: ${filename}`);
    const text = await extractPdfText(file);
    textStories[String(story)] = text;
    const textPath = path.join(
      TEXT_DIR,
      `${String(story).padStart(2, "0")}.txt`,
    );
    if (!dryRun) {
      await writeFile(textPath, text, "utf8");
    }

    if (!dryRun && !textOnly) {
      const localFlag = local ? " --local" : "";
      console.log(
        `Uploading ${filename} → r2://${BUCKET}/${r2Key}${local ? " (local)" : ""}`,
      );
      execSync(
        `npx wrangler r2 object put "${BUCKET}/${r2Key}" --file="${file}" --content-type=application/pdf${localFlag}`,
        { cwd: ROOT, stdio: "inherit" },
      );
      console.log(`Uploading text → r2://${BUCKET}/${textR2Key}`);
      execSync(
        `npx wrangler r2 object put "${BUCKET}/${textR2Key}" --file="${textPath}" --content-type=text/plain;charset=utf-8${localFlag}`,
        { cwd: ROOT, stdio: "inherit" },
      );
    } else if (dryRun) {
      console.log(`[dry-run] would upload ${filename} → ${r2Key} + ${textR2Key}`);
    } else {
      console.log(`[text-only] wrote ${textPath} (${text.length} chars)`);
    }
  }

  const manifest = {
    language: "id",
    languageName: "Indonesian",
    source:
      "Self-hosted PDFs (issue unfoldingWord/bt-servant-engine#215) — used only when DCS has no OBS Theological Formation (tc-ready) for the language",
    license: "CC BY-SA 4.0",
    stories,
  };

  const textJson = {
    language: "id",
    stories: textStories,
  };

  if (!dryRun) {
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(TEXT_JSON_PATH, JSON.stringify(textJson) + "\n");
  }

  console.log(
    `Processed ${stories.length} stories` +
      (dryRun
        ? " (dry-run, no writes)"
        : `; wrote ${MANIFEST_PATH} + ${TEXT_JSON_PATH}`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
