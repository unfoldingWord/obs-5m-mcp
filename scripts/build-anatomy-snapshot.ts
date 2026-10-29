/**
 * Saves a short excerpt of each part of OBS-TF story 1 for the home page.
 * The page shows live content; this snapshot is only its fallback.
 *
 *   tsx scripts/build-anatomy-snapshot.ts
 *
 * Reads story 1 from Door43. If Door43 cannot be reached, it keeps the
 * existing snapshot, or builds one from the test fixture.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadStoryBundle, type StoryBundle } from "../src/content/contentService.js";
import { parseObsTfReference } from "../src/content/obsTfReference.js";
import { buildStudyManualPayload, formatStudyManualMd } from "../src/content/studyManual.js";
import { ANATOMY_PARTS } from "../web/src/lib/anatomy/parts.js";

const MAX = 600;

function excerpt(md: string): string {
  // Drop the "# Title (OBS 1)" and "*Session part*" lines the formatter adds.
  const body = md
    .split("\n")
    .filter((l) => !/^# /.test(l) && !/^\*Session part:/.test(l))
    .join("\n")
    .trim();
  if (body.length <= MAX) return body;
  const cut = body.lastIndexOf("\n", MAX);
  return body.slice(0, cut > MAX / 2 ? cut : MAX).trimEnd() + "\n\n…";
}

export function buildAnatomySnapshot(bundle: StoryBundle): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of ANATOMY_PARTS) {
    // Keep one panel for Movement 1 in the snapshot fallback, even though the live call uses a range.
    const reference = p.part === "movement1" ? "1:5" : p.call.reference;
    const ref = parseObsTfReference(reference)!;
    const payload = buildStudyManualPayload(bundle, { ref, part: p.part });
    let md = formatStudyManualMd(payload);
    if (p.call.include_answers === false) {
      md = md
        .split("\n")
        .filter((l) => !/^\s*- \*\*A:\*\*/.test(l))
        .join("\n");
    }
    out[p.part] = excerpt(md);
  }
  return out;
}

async function main() {
  const target = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "web",
    "src",
    "lib",
    "anatomy",
    "snapshot.json",
  );
  let bundle: StoryBundle | null = null;
  try {
    bundle = await loadStoryBundle("en", 1, {} as never);
  } catch (err) {
    if (existsSync(target)) {
      console.warn(`anatomy snapshot: Door43 unavailable, keeping ${target}`);
      return;
    }
    console.warn("anatomy snapshot: Door43 unavailable, using the test fixture");
    const { loadStory1 } = await import("../tests/fixtures/loadStory1.js");
    bundle = loadStory1();
    void err;
  }
  writeFileSync(target, JSON.stringify(buildAnatomySnapshot(bundle), null, 2) + "\n");
  console.log(`anatomy snapshot: wrote ${target}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
