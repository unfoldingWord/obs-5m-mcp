/**
 * Build a Door43-ready OBS Theological Formation repo tree from converted PDF markdown.
 *
 * Prerequisites:
 *   npm run ingest:id -- --text-only
 *   npm run convert:id
 *
 * Usage:
 *   npm run export:dcs              # → exports/id_obs_tf/
 *   npm run export:dcs -- --convert # run convert:id first
 *   npm run export:dcs -- --out=./tmp/id_obs_tf
 *   npm run export:dcs -- --lang=id --repo-name=id_obs_tf
 *
 * Then create an empty Door43 repo and push this folder:
 *   cd exports/id_obs_tf
 *   git init && git add . && git commit -m "Initial id_obs_tf from Indonesian PDFs"
 *   # add Door43 remote and push (see README in the export)
 */

import { execSync } from "node:child_process";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const LANG_META: Record<
  string,
  {
    languageTitle: string;
    direction: "ltr" | "rtl";
    repoName: string;
    title: string;
    description: string;
    relation: string[];
  }
> = {
  id: {
    languageTitle: "Indonesian",
    direction: "ltr",
    repoName: "id_obs_tf",
    title: "Cerita Alkitab Terbuka + Formasi Teologis (Five Movements)",
    description:
      "Open Bible Stories + Theological Formation (Five Movements) in Indonesian. " +
      "Converted from self-hosted Indonesian PDFs into en_obs_tf-compatible markdown " +
      "for Door43. Source PDFs: unfoldingWord/bt-servant-engine#215. License CC BY-SA 4.0.",
    relation: ["id/obs", "en/obs"],
  },
};

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildManifest(options: {
  language: string;
  version: string;
  storyCount: number;
  storyNums: number[];
}): string {
  const meta = LANG_META[options.language];
  if (!meta) throw new Error(`Unsupported language for export: ${options.language}`);
  const date = todayIsoDate();
  const storiesNote =
    options.storyNums.length < 50
      ? ` Currently includes stories ${options.storyNums[0]}–${options.storyNums[options.storyNums.length - 1]} (${options.storyCount} of 50).`
      : "";

  return `---

dublin_core:
  conformsto: 'rc0.2'
  contributor:
    - 'unfoldingWord'
    - 'Door43 World Missions Community'
  creator: 'unfoldingWord'
  description: '${meta.description.replace(/'/g, "''")}${storiesNote.replace(/'/g, "''")}'
  format: 'text/markdown'
  identifier: 'obs'
  issued: '${date}'
  language:
    direction: '${meta.direction}'
    identifier: '${options.language}'
    title: '${meta.languageTitle}'
  modified: '${date}'
  publisher: 'unfoldingWord'
  relation:
${meta.relation.map((r) => `    - '${r}'`).join("\n")}
  rights: 'CC BY-SA 4.0'
  source:
    -
      identifier: 'obs'
      language: 'en'
      version: '9'
    -
      identifier: 'obs_tf'
      language: 'en'
      version: '3'
  subject: 'OBS Theological Formation'
  title: '${meta.title.replace(/'/g, "''")}'
  type: 'book'
  version: '${options.version}'

checking:
  checking_entity:
    - 'unfoldingWord'
  checking_level: '1'

projects:
  -
    categories:
    identifier: 'obs'
    path: '.'
    sort: 0
    title: '${meta.title.replace(/'/g, "''")}'
    versification:
`;
}

/** Normalize story frontmatter toward en_obs_tf (drop converter-only keys). */
function normalizeStoryMarkdown(md: string, storyNum: number): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!fm) return md;
  const body = md.slice(fm[0].length);
  const lines = fm[1].split(/\r?\n/);
  const keep = new Set([
    "title",
    "subtitle",
    "layout",
    "story_num",
  ]);
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const m = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    if (keep.has(m[1])) fields[m[1]] = m[2];
  }
  fields.title = fields.title || "Open Bible Stories";
  fields.layout = fields.layout || "obs_story";
  fields.story_num = String(storyNum);
  if (!fields.subtitle) fields.subtitle = `Story ${storyNum}`;

  const outFm = [
    "---",
    `title: ${fields.title.replace(/^["']|["']$/g, "")}`,
    `subtitle: ${fields.subtitle.replace(/^["']|["']$/g, "")}`,
    "layout: obs_story",
    `story_num: ${storyNum}`,
    "---",
    "",
  ].join("\n");
  return outFm + body.replace(/^\n+/, "");
}

function buildExportReadme(options: {
  language: string;
  repoName: string;
  storyNums: number[];
  outDir: string;
}): string {
  const meta = LANG_META[options.language]!;
  return `# ${options.repoName}

${meta.title}

Resource Container (rc0.2) for **OBS Theological Formation**, language \`${options.language}\`.

Generated from Indonesian Five Movements PDFs by [obs-5m-mcp](https://github.com/unfoldingWord/obs-5m-mcp) (\`npm run export:dcs\`).

## Contents

- \`manifest.yaml\` — Door43 / RC metadata (\`subject: OBS Theological Formation\`)
- \`obs_story_N.md\` — stories ${options.storyNums.join(", ")}
- \`transclusions/\` — shared movement/conclusion templates only (EN-style)
- \`LICENSE.md\` — CC BY-SA 4.0 notice

Structural headings follow English \`en_obs_tf\` so tools can parse movements the same way; body text is Indonesian.

## Upload to Door43

1. Create an empty repository on Door43, e.g. \`unfoldingWord/${options.repoName}\` (or your org).
2. From this folder:

\`\`\`bash
git init
git add .
git commit -m "Initial ${options.repoName} from Indonesian OBS-TF PDFs"
git branch -M master
git remote add origin https://git.door43.org/<org>/${options.repoName}.git
git push -u origin master
\`\`\`

3. In Door43, create a release / publish so the catalog can index it with:
   - subject: \`OBS Theological Formation\`
   - topic: \`tc-ready\` (when approved)
   - stage: \`prod\`

4. Verify:

\`\`\`bash
curl -s "https://git.door43.org/api/v1/catalog/search?topic=tc-ready&stage=prod&subject=OBS%20Theological%20Formation&lang=${options.language}"
\`\`\`

## Source

- English structure reference: \`unfoldingWord/en_obs_tf\`
- Indonesian PDF pack: [bt-servant-engine#215](https://github.com/unfoldingWord/bt-servant-engine/issues/215)
- Local export path: \`${options.outDir}\`

## Notes

- Checking level is set to \`1\` (converted draft). Raise after human review.
- Stories beyond the PDF pack are not included yet.
- Community Study is story-unique and embedded inline in each \`obs_story_N.md\`.
- Shared movements/conclusion match English \`en_obs_tf\`: \`![[movement_2_drafting]]\`, \`![[movement_3_checking]]\`, \`![[movement_4]]\`, \`![[movement_5]]\`, \`![[conclusion]]\`.
- When a story's movement/conclusion wording diverges from the shared template, that section is inlined into the story instead of linked.
`;
}

function buildLicense(): string {
  return `# License

This work is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0).

https://creativecommons.org/licenses/by-sa/4.0/

Attribution: unfoldingWord® and partners. Indonesian Five Movements PDF content converted for Door43 distribution.

Source English resource: unfoldingWord Open Bible Stories + Theological Formation (\`en_obs_tf\`).
`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const language = (argValue("--lang") || "id").toLowerCase();
  const meta = LANG_META[language];
  if (!meta) {
    console.error(
      `Unsupported --lang=${language}. Supported: ${Object.keys(LANG_META).join(", ")}`,
    );
    process.exit(1);
  }

  const repoName = argValue("--repo-name") || meta.repoName;
  const version = argValue("--version") || "0.1.0";
  const outDir = path.resolve(
    ROOT,
    argValue("--out") || path.join("exports", repoName),
  );
  const sourceDir = path.join(ROOT, "data", "obs-tf-md", language);
  const runConvert = process.argv.includes("--convert");
  const force = process.argv.includes("--force");

  if (runConvert) {
    console.log("Running npm run convert:id …");
    execSync("npm run convert:id", { cwd: ROOT, stdio: "inherit" });
  }

  if (!(await pathExists(sourceDir))) {
    console.error(
      `Missing ${sourceDir}. Run: npm run convert:id  (or npm run export:dcs -- --convert)`,
    );
    process.exit(1);
  }

  const entries = await readdir(sourceDir);
  const storyFiles = entries
    .filter((f) => /^obs_story_\d+\.md$/i.test(f))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/\d+/)![0], 10);
      const nb = Number.parseInt(b.match(/\d+/)![0], 10);
      return na - nb;
    });

  if (!storyFiles.length) {
    console.error(`No obs_story_*.md in ${sourceDir}. Run convert:id first.`);
    process.exit(1);
  }

  const storyNums = storyFiles.map((f) =>
    Number.parseInt(f.match(/\d+/)![0], 10),
  );

  if (await pathExists(outDir)) {
    if (!force) {
      console.error(
        `Output exists: ${outDir}\nRe-run with --force to replace, or --out=…`,
      );
      process.exit(1);
    }
    await rm(outDir, { recursive: true, force: true });
  }

  await mkdir(path.join(outDir, "transclusions"), { recursive: true });

  // Stories
  for (const file of storyFiles) {
    const storyNum = Number.parseInt(file.match(/\d+/)![0], 10);
    const raw = await readFile(path.join(sourceDir, file), "utf8");
    const normalized = normalizeStoryMarkdown(raw, storyNum);
    await writeFile(path.join(outDir, file), normalized, "utf8");
  }

  // Transclusions (shared + community studies)
  const transSrc = path.join(sourceDir, "transclusions");
  if (await pathExists(transSrc)) {
    const tFiles = await readdir(transSrc);
    for (const f of tFiles) {
      if (!f.endsWith(".md")) continue;
      await cp(path.join(transSrc, f), path.join(outDir, "transclusions", f));
    }
  }

  await writeFile(
    path.join(outDir, "manifest.yaml"),
    buildManifest({
      language,
      version,
      storyCount: storyNums.length,
      storyNums,
    }),
    "utf8",
  );
  await writeFile(path.join(outDir, "LICENSE.md"), buildLicense(), "utf8");
  await writeFile(
    path.join(outDir, "README.md"),
    buildExportReadme({
      language,
      repoName,
      storyNums,
      outDir: path.relative(ROOT, outDir).replace(/\\/g, "/"),
    }),
    "utf8",
  );
  await writeFile(
    path.join(outDir, ".gitignore"),
    ".DS_Store\n*.log\n.idea/\n.vscode/\n",
    "utf8",
  );

  // Manifest of what was exported (for humans / CI)
  await writeFile(
    path.join(outDir, "EXPORT_META.json"),
    JSON.stringify(
      {
        language,
        repoName,
        version,
        generatedAt: new Date().toISOString(),
        source: path.relative(ROOT, sourceDir).replace(/\\/g, "/"),
        stories: storyNums,
        subject: "OBS Theological Formation",
        rights: "CC BY-SA 4.0",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`Exported Door43 tree → ${outDir}`);
  console.log(`  stories: ${storyNums.length} (${storyNums[0]}–${storyNums[storyNums.length - 1]})`);
  console.log(`  next: cd ${path.relative(ROOT, outDir)} && git init && … (see README.md)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
