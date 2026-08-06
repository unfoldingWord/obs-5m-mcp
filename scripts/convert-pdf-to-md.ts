/**
 * Convert Indonesian PDF plain text / font-aware plain MD → en_obs_tf-shaped markdown
 * and compare to DCS.
 *
 * Canonical path: PDF → font-aware plain MD → DCS-shaped MD.
 *
 * Usage:
 *   npm run convert:id
 *   npm run convert:id -- --story=2
 *   npm run convert:id -- --compare-only
 *   npm run convert:id -- --offline
 *   npm run convert:id -- --from-pdf      (generate missing plain MD via plain-pdf-to-md)
 *   npm run convert:id -- --regen-plain   (force re-extract plain MD from PDF, then convert)
 *   npm run convert:id:from-pdf           (same as --from-pdf for all stories)
 */

import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  access,
  unlink,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertPdfTextToObsTfMd,
  countTranslationTerms,
  stripYamlFrontmatter,
} from "../src/content/pdfToObsTfMd.js";
import {
  compareStructures,
  loadStructureMap,
  buildDcsStructureProfile,
} from "../src/content/structureMap.js";
import { parseObsTfStoryMarkdown } from "../src/content/obsTfParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LANG = "id";
const TEXT_DIR = path.join(ROOT, "data", "indonesian-text");
const TEXT_JSON = path.join(ROOT, "data", "indonesian-text.json");
const PLAIN_DIR = path.join(ROOT, "exports", "pdf-plain-md");
const OUT_DIR = path.join(ROOT, "data", "obs-tf-md", LANG);
const TRANS_DIR = path.join(OUT_DIR, "transclusions");
const BUNDLE_PATH = path.join(OUT_DIR, "bundle.json");
const REPORT_PATH = path.join(OUT_DIR, "structure-report.json");
const FIXTURE_STORY1 = path.join(
  ROOT,
  "tests",
  "fixtures",
  "en_obs_tf",
  "obs_story_1.md",
);

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function plainMdPath(storyNum: number): string {
  return path.join(PLAIN_DIR, `OBS_${storyNum}_Indonesia.plain.md`);
}

async function loadFallbackTexts(): Promise<Record<string, string>> {
  try {
    const json = JSON.parse(await readFile(TEXT_JSON, "utf8")) as {
      stories?: Record<string, string>;
    };
    if (json.stories && Object.keys(json.stories).length) return json.stories;
  } catch {
    /* fall through */
  }
  const out: Record<string, string> = {};
  let files: string[] = [];
  try {
    files = await readdir(TEXT_DIR);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith(".txt")) continue;
    const n = Number.parseInt(f, 10);
    if (!Number.isFinite(n)) continue;
    out[String(n)] = await readFile(path.join(TEXT_DIR, f), "utf8");
  }
  return out;
}

async function generatePlainMd(storyNum: number): Promise<string | null> {
  const p = plainMdPath(storyNum);
  console.log(`Generating plain MD for story ${storyNum}…`);
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/plain-pdf-to-md.ts", `--story=${storyNum}`],
    { cwd: ROOT, encoding: "utf8", shell: true },
  );
  if (result.status !== 0) {
    console.warn(result.stderr || result.stdout);
    return null;
  }
  if (!(await exists(p))) return null;
  return stripYamlFrontmatter(await readFile(p, "utf8"));
}

async function ensurePlainMd(
  storyNum: number,
  opts: { fromPdf: boolean; regenPlain: boolean },
): Promise<string | null> {
  const p = plainMdPath(storyNum);
  if (opts.regenPlain) {
    return generatePlainMd(storyNum);
  }
  if (await exists(p)) {
    return stripYamlFrontmatter(await readFile(p, "utf8"));
  }
  if (!opts.fromPdf) return null;
  return generatePlainMd(storyNum);
}

async function loadStoryInput(
  storyNum: number,
  opts: { fromPdf: boolean; regenPlain: boolean },
  fallbacks: Record<string, string>,
): Promise<{ text: string; source: "plain-md" | "txt-fallback" } | null> {
  const plain = await ensurePlainMd(storyNum, opts);
  if (plain?.trim()) return { text: plain, source: "plain-md" };
  const fb = fallbacks[String(storyNum)];
  if (fb?.trim()) return { text: fb, source: "txt-fallback" };
  return null;
}

function skeletonFlags(storyMarkdown: string, storyNum: number) {
  return {
    hasBiblicalInterpretation:
      /^## (?:Biblical Interpretation|Penafsiran Alkitab|Interpretasi Alkitab|2\b)/m.test(
        storyMarkdown,
      ),
    hasTheologicalDialogue:
      /^## (?:Theological Dialogue|Dialog Teologis|Percakapan Teologis|3\b)/m.test(
        storyMarkdown,
      ),
    hasPersonalReflection:
      /^## (?:Personal Reflection|Refleksi Pribadi|4\b)/m.test(storyMarkdown),
    hasCommunityStudyInline:
      /^#{1,2}\s+(?:Studi Komunitas|Community Study)/m.test(storyMarkdown),
    hasMovement2Tx: storyMarkdown.includes("![[movement_2_drafting]]"),
    hasMovement3Tx: storyMarkdown.includes("![[movement_3_checking]]"),
    hasMovement4Tx: storyMarkdown.includes("![[movement_4]]"),
    hasMovement5Tx: storyMarkdown.includes("![[movement_5]]"),
    hasConclusionTx: storyMarkdown.includes("![[conclusion]]"),
  };
}

/** Shared EN-style TX filenames (not per-story). */
const SHARED_TX = new Set([
  "movement_2_drafting.md",
  "movement_3_checking.md",
  "movement_4.md",
  "movement_5.md",
  "conclusion.md",
]);

/** Below this Dice similarity, keep a per-story override instead of shared.
 *  0.99 catches near-dupes that still drop coverage (e.g. terjemahan vs penerjemahan). */
const SHARED_TX_OVERRIDE_THRESHOLD = 0.99;

type SharedTxCandidate = { storyNum: number; content: string };

/** Pick majority exact text; tie-break by longest (most complete). */
function pickBestSharedVariant(variants: string[]): string {
  const groups = new Map<string, string[]>();
  for (const v of variants) {
    const norm = v.replace(/\r\n/g, "\n");
    const list = groups.get(norm) ?? [];
    list.push(norm);
    groups.set(norm, list);
  }
  let best: string | null = null;
  let bestCount = -1;
  let bestLen = -1;
  for (const [text, list] of groups) {
    if (
      list.length > bestCount ||
      (list.length === bestCount && text.length > bestLen)
    ) {
      best = text;
      bestCount = list.length;
      bestLen = text.length;
    }
  }
  return best ?? variants[0]!;
}

function normalizeTxWords(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Dice coefficient on word multisets (0–1). */
function diceSimilarity(a: string, b: string): number {
  const ta = normalizeTxWords(a);
  const tb = normalizeTxWords(b);
  if (!ta.length && !tb.length) return 1;
  const count = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const w of arr) m.set(w, (m.get(w) || 0) + 1);
    return m;
  };
  const A = count(ta);
  const B = count(tb);
  let inter = 0;
  for (const [w, n] of A) {
    if (B.has(w)) inter += Math.min(n, B.get(w)!);
  }
  return (2 * inter) / (ta.length + tb.length);
}

async function discoverStoryNums(
  fallbacks: Record<string, string>,
): Promise<number[]> {
  const nums = new Set<number>();
  for (const k of Object.keys(fallbacks)) {
    const n = Number.parseInt(k, 10);
    if (Number.isFinite(n)) nums.add(n);
  }
  try {
    const files = await readdir(PLAIN_DIR);
    for (const f of files) {
      const m = /^OBS_(\d+)_Indonesia\.plain\.md$/.exec(f);
      if (m) nums.add(Number.parseInt(m[1]!, 10));
    }
  } catch {
    /* none */
  }
  return [...nums].sort((a, b) => a - b);
}

async function fetchDcsStory(
  storyNum: number,
  offline: boolean,
): Promise<string | null> {
  if (offline && storyNum === 1) {
    try {
      return await readFile(FIXTURE_STORY1, "utf8");
    } catch {
      return null;
    }
  }
  const url = `https://git.door43.org/unfoldingWord/en_obs_tf/raw/branch/master/obs_story_${storyNum}.md`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (storyNum === 1) {
        try {
          return await readFile(FIXTURE_STORY1, "utf8");
        } catch {
          return null;
        }
      }
      return null;
    }
    return await res.text();
  } catch {
    if (storyNum === 1) {
      try {
        return await readFile(FIXTURE_STORY1, "utf8");
      } catch {
        return null;
      }
    }
    return null;
  }
}

function softMetrics(
  storyMarkdown: string,
  dcsMd: string | null,
  storyNum: number,
) {
  const converted = parseObsTfStoryMarkdown(storyMarkdown);
  const convProfile = buildDcsStructureProfile(storyMarkdown);
  const refProfile = dcsMd ? buildDcsStructureProfile(dcsMd) : null;
  const translationTerms = countTranslationTerms(storyMarkdown);

  return {
    frameCount: convProfile.frameCount,
    observationFrameCount: convProfile.observationFrameIds.length,
    discourseCount: convProfile.discourseCount,
    theologicalCount: convProfile.theologicalCount,
    journalCount: convProfile.journalCount,
    hasCommunityStudyTransclusion: Boolean(
      converted.communityStudyRef &&
        /community_study/i.test(converted.communityStudyRef.file),
    ),
    hasInlineCommunityStudy: Boolean(converted.inlineCommunityStudy),
    translationTermTotal: translationTerms.total,
    translationTermsPerFrame: translationTerms.perFrame,
    translationFragmentedFrames: translationTerms.fragmentedFrames,
    skeleton: skeletonFlags(storyMarkdown, storyNum),
    reference: refProfile
      ? {
          frameCount: refProfile.frameCount,
          observationFrameCount: refProfile.observationFrameIds.length,
          discourseCount: refProfile.discourseCount,
          discourseCountDelta:
            convProfile.discourseCount - refProfile.discourseCount,
        }
      : null,
  };
}

async function main() {
  const compareOnly = process.argv.includes("--compare-only");
  const offline = process.argv.includes("--offline");
  const fromPdf = process.argv.includes("--from-pdf");
  const regenPlain = process.argv.includes("--regen-plain");
  const storyFilter = argValue("--story");
  const map = loadStructureMap(LANG);
  const fallbacks = await loadFallbackTexts();
  const storyNums = (await discoverStoryNums(fallbacks)).filter(
    (n) => !storyFilter || n === Number.parseInt(storyFilter, 10),
  );

  if (!storyNums.length) {
    console.error(
      "No Indonesian PDF text or plain MD found. Canonical path:\n" +
        "  npm run plain-md -- --story=1   # PDF → font-aware plain MD\n" +
        "  npm run convert:id              # plain MD → DCS-shaped MD\n" +
        "  or: npm run convert:id -- --from-pdf / --regen-plain\n" +
        "  or: npm run ingest:id -- --text-only  (txt fallback)",
    );
    process.exit(1);
  }

  await mkdir(TRANS_DIR, { recursive: true });

  const bundle = {
    language: LANG,
    stories: {} as Record<string, string>,
    transclusions: {} as Record<string, string>,
  };

  if (storyFilter) {
    try {
      const prev = JSON.parse(await readFile(BUNDLE_PATH, "utf8")) as typeof bundle;
      Object.assign(bundle.stories, prev.stories ?? {});
      Object.assign(bundle.transclusions, prev.transclusions ?? {});
    } catch {
      /* fresh */
    }
  }

  const report: {
    language: string;
    generatedAt: string;
    stories: Array<Record<string, unknown>>;
  } = {
    language: LANG,
    generatedAt: new Date().toISOString(),
    stories: [],
  };

  let failedRequired = 0;
  /** Accumulate shared TX variants across stories, then pick majority/longest. */
  const sharedTxCandidates: Record<string, SharedTxCandidate[]> = {};

  for (const storyNum of storyNums) {
    const dcsMd = await fetchDcsStory(storyNum, offline);

    let storyMarkdown: string;
    let transclusions: Record<string, string>;
    let inputSource: string | undefined;

    if (compareOnly) {
      try {
        storyMarkdown = await readFile(
          path.join(OUT_DIR, `obs_story_${storyNum}.md`),
          "utf8",
        );
      } catch {
        console.error(`Missing converted MD for story ${storyNum}`);
        failedRequired++;
        continue;
      }
      transclusions = {};
    } else {
      const input = await loadStoryInput(
        storyNum,
        { fromPdf: fromPdf || regenPlain, regenPlain },
        fallbacks,
      );
      if (!input) {
        console.error(`No input for story ${storyNum}`);
        failedRequired++;
        continue;
      }
      inputSource = input.source;
      const converted = convertPdfTextToObsTfMd({
        language: LANG,
        storyNum,
        pdfText: input.text,
        dcsReferenceMd: dcsMd ?? undefined,
        structureMap: map,
      });
      storyMarkdown = converted.storyMarkdown;
      transclusions = converted.transclusions;

      await writeFile(
        path.join(OUT_DIR, `obs_story_${storyNum}.md`),
        storyMarkdown,
        "utf8",
      );
      for (const [file, content] of Object.entries(transclusions)) {
        if (SHARED_TX.has(file)) {
          (sharedTxCandidates[file] ??= []).push({ storyNum, content });
          continue;
        }
        // Per-story community study (and any other unique TX)
        await writeFile(path.join(TRANS_DIR, file), content, "utf8");
        bundle.transclusions[file] = content;
      }
      bundle.stories[String(storyNum)] = storyMarkdown;
      console.log(
        `Converted story ${storyNum} ← ${inputSource} → obs_story_${storyNum}.md (${storyMarkdown.length} chars)`,
      );
    }

    const metrics = softMetrics(storyMarkdown, dcsMd, storyNum);
    if (metrics.translationFragmentedFrames.length) {
      console.warn(
        `Story ${storyNum}: soft warning — translation term issues on frames: ${metrics.translationFragmentedFrames.join(", ")}`,
      );
    }

    if (dcsMd) {
      const cmp = compareStructures(storyMarkdown, dcsMd, map);
      report.stories.push({
        story: storyNum,
        ok: cmp.ok,
        inputSource,
        mismatches: cmp.mismatches,
        softMetrics: metrics,
        converted: {
          frameCount: cmp.converted.frameCount,
          observationFrames: cmp.converted.observationFrameIds.length,
          discourseCount: cmp.converted.discourseCount,
        },
        reference: {
          frameCount: cmp.reference.frameCount,
          observationFrames: cmp.reference.observationFrameIds.length,
          discourseCount: cmp.reference.discourseCount,
        },
      });
      if (!cmp.ok) {
        failedRequired++;
        console.warn(
          `Story ${storyNum}: ${cmp.mismatches.filter((m) => m.severity === "required").length} required mismatch(es)`,
        );
        for (const m of cmp.mismatches.filter((x) => x.severity === "required")) {
          console.warn(`  - ${m.check}: ${m.message}`);
        }
      } else {
        const soft = cmp.mismatches.filter((m) => m.severity === "soft").length;
        console.log(
          `Story ${storyNum}: structure OK` +
            (soft ? ` (${soft} soft warning(s))` : "") +
            (metrics.hasInlineCommunityStudy
              ? "; community=inline"
              : metrics.hasCommunityStudyTransclusion
                ? "; community=transclusion"
                : ""),
        );
      }
    } else {
      report.stories.push({
        story: storyNum,
        ok: true,
        inputSource,
        softMetrics: metrics,
        note: "No DCS reference available for comparison",
      });
      console.log(`Story ${storyNum}: converted (no DCS reference to compare)`);
    }
  }

  if (!compareOnly) {
    // Drop stale per-story / community TX files (unique content is inlined)
    try {
      const tFiles = await readdir(TRANS_DIR);
      for (const f of tFiles) {
        if (!f.endsWith(".md")) continue;
        if (SHARED_TX.has(f)) continue;
        // Remove community_study_* and any *_story_N movement overrides
        if (
          f.startsWith("community_study_") ||
          /^(movement_2_drafting|movement_3_checking|movement_4|movement_5|conclusion)_story_\d+\.md$/.test(
            f,
          )
        ) {
          await unlink(path.join(TRANS_DIR, f));
        }
      }
    } catch {
      /* none */
    }

    // Shared TX only; divergent story wording is inlined into that story
    let inlineCount = 0;
    for (const [file, variants] of Object.entries(sharedTxCandidates)) {
      const best = pickBestSharedVariant(variants.map((v) => v.content));
      await writeFile(path.join(TRANS_DIR, file), best, "utf8");
      bundle.transclusions[file] = best;
      const base = file.replace(/\.md$/i, "");
      console.log(
        `Shared TX ${file}: picked among ${variants.length} story variants (${best.length} chars)`,
      );
      for (const { storyNum, content } of variants) {
        const sim = diceSimilarity(content, best);
        if (sim >= SHARED_TX_OVERRIDE_THRESHOLD) continue;
        const storyPath = path.join(OUT_DIR, `obs_story_${storyNum}.md`);
        let md = await readFile(storyPath, "utf8");
        const from = `![[${base}]]`;
        if (!md.includes(from)) continue;
        const inlineBody = content.replace(/\r\n/g, "\n").trim() + "\n";
        md = md.split(from).join(inlineBody.trimEnd());
        await writeFile(storyPath, md, "utf8");
        bundle.stories[String(storyNum)] = md;
        inlineCount += 1;
        console.log(
          `  inline ${base} into obs_story_${storyNum}.md (Dice ${(sim * 100).toFixed(1)}% < ${(SHARED_TX_OVERRIDE_THRESHOLD * 100).toFixed(0)}%)`,
        );
      }
    }
    if (inlineCount) {
      console.log(
        `Inlined ${inlineCount} divergent shared-section variant(s) into stories`,
      );
    }

    const mdFiles = await readdir(OUT_DIR);
    for (const f of mdFiles) {
      const m = /^obs_story_(\d+)\.md$/.exec(f);
      if (!m) continue;
      bundle.stories[m[1]!] = await readFile(path.join(OUT_DIR, f), "utf8");
    }
    try {
      const tFiles = await readdir(TRANS_DIR);
      bundle.transclusions = {};
      for (const f of tFiles) {
        if (!f.endsWith(".md")) continue;
        bundle.transclusions[f] = await readFile(
          path.join(TRANS_DIR, f),
          "utf8",
        );
      }
    } catch {
      /* none */
    }
    await writeFile(BUNDLE_PATH, JSON.stringify(bundle) + "\n", "utf8");
    console.log(`Wrote ${BUNDLE_PATH}`);
  }

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${REPORT_PATH}`);

  if (failedRequired > 0) {
    console.error(`${failedRequired} story(ies) failed required structure checks`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
