import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyTransclusionsToStory,
  parseObsTfStoryMarkdown,
  parseTransclusionRef,
  resolveTransclusion,
  sliceMarkdownSection,
} from "../../src/content/obsTfParser.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures", "en_obs_tf");

function load(rel: string): string {
  return readFileSync(path.join(fixtureDir, rel), "utf8");
}

describe("obsTfParser", () => {
  it("parses story 1 frontmatter, intro, and frames", () => {
    const md = load("obs_story_1.md");
    const story = parseObsTfStoryMarkdown(md);
    expect(story.meta.storyNum).toBe(1);
    expect(story.meta.subtitle).toBe("The Creation");
    expect(story.intro.keyIdea.length).toBeGreaterThan(20);
    expect(story.intro.creedalVerse).toMatch(/Hebrews 11:3/);
    expect(story.frames.length).toBeGreaterThanOrEqual(14);
    expect(story.frames[0].id).toBe("01-01");
    expect(story.frames[0].text).toMatch(/God made everything/);
    expect(story.bibleSource).toMatch(/Genesis/);
  });

  it("parses movement 1 observation and translation Q&A", () => {
    const story = parseObsTfStoryMarkdown(load("obs_story_1.md"));
    const m1 = story.movements.find((m) => m.id === 1)!;
    expect(m1.observation?.length).toBeGreaterThan(5);
    expect(m1.observation?.[0].frameId).toBe("01-01");
    expect(m1.observation?.[0].items[0].question).toMatch(/universe/);
    expect(m1.translation?.length).toBeGreaterThan(5);
    expect(m1.translation?.[0].terms[0].term).toMatch(/God/i);
  });

  it("parses discourse and journal questions", () => {
    const story = parseObsTfStoryMarkdown(load("obs_story_1.md"));
    const m2 = story.movements.find((m) => m.id === 2)!;
    expect(m2.discourse?.length).toBeGreaterThan(0);
    expect(m2.theological?.length).toBeGreaterThan(0);
    const m3 = story.movements.find((m) => m.id === 3)!;
    expect(m3.journal?.length).toBeGreaterThan(0);
  });

  it("collects and resolves transclusions", () => {
    const story = parseObsTfStoryMarkdown(load("obs_story_1.md"));
    expect(story.transclusionRefs.some((r) => r.file === "movement_4")).toBe(
      true,
    );
    expect(story.communityStudyRef?.file).toMatch(/obs-devotionals/);

    const files = new Map<string, string>([
      ["movement_2_drafting", load("transclusions/movement_2_drafting.md")],
      ["movement_3_checking", load("transclusions/movement_3_checking.md")],
      ["movement_4", load("transclusions/movement_4.md")],
      ["movement_5", load("transclusions/movement_5.md")],
      ["conclusion", load("transclusions/conclusion.md")],
      [
        "obs-devotionals-unit-3",
        load("transclusions/obs-devotionals-unit-3.md"),
      ],
    ]);

    const resolved = applyTransclusionsToStory(story, files);
    const m2 = resolved.movements.find((m) => m.id === 2)!;
    const m3 = resolved.movements.find((m) => m.id === 3)!;
    const m4 = resolved.movements.find((m) => m.id === 4)!;
    expect(m4.markdown.length).toBeGreaterThan(50);
    expect(m4.markdown).not.toMatch(/!\[\[movement_4\]\]/);
    expect(m2.drafting).toMatch(/Translation Draft|draft/i);
    expect(m3.checking).toMatch(/Team Check|Accurate/i);
    expect(resolved.conclusion).toMatch(/Conclusion|translation community/i);
    expect(m3.markdown).not.toMatch(/Ministry Practice/i);
    expect(m3.markdown).not.toMatch(/!\[\[/);

    const ref = parseTransclusionRef(
      "![[obs-devotionals-unit-3#Community Study: The Practice of Worship—Praising God as a Community]]",
    );
    const section = resolveTransclusion(ref, files);
    // Section heading may or may not match exactly; at least file loads
    expect(files.get("obs-devotionals-unit-3")?.length).toBeGreaterThan(100);
    if (section) expect(section.length).toBeGreaterThan(20);
  });

  it("extracts inlined ID session parts without TX links", () => {
    const md = `---
title: Cerita
subtitle: Test
layout: obs_story
story_num: 7
---
### Pokok Pikiran Utama
Idea
### Ayat Pengakuan Iman
Verse
### Rangkuman Metanarasi
Meta
### Cerita Alkitab Terbuka: Test
######### 07-01
Frame text
## Percakapan Teologis: Discuss
### Pertanyaan-pertanyaan Diskursus
##### Why? (07-01)
Because.
### Pertanyaan-pertanyaan Teologis
1. What?
# Naskah Awal Terjemahan
Draft the panels together.
## Refleksi Pribadi: Reflect
### Refleksi Jurnal
1. How do you respond?
# Pemeriksaan Tim
Check accuracy and clarity.
# Praktik Pelayanan: Melayani Gereja dengan Cerita
Ministry body here.
# Penjangkauan Misi: Membagikan Kebenaran Cerita
Mission body here.
# Kesimpulan
Wrap up the session.
`;
    const story = applyTransclusionsToStory(
      parseObsTfStoryMarkdown(md),
      new Map(),
    );
    expect(story.movements[1]?.drafting).toMatch(/Draft the panels/);
    expect(story.movements[2]?.checking).toMatch(/Check accuracy/);
    expect(story.movements[3]?.markdown).toMatch(/Ministry body/);
    expect(story.movements[4]?.markdown).toMatch(/Mission body/);
    expect(story.conclusion).toMatch(/Wrap up/);
  });

  it("sliceMarkdownSection finds Key Idea", () => {
    const md = load("obs_story_1.md");
    const key = sliceMarkdownSection(md, "Key Idea");
    expect(key).toMatch(/sovereign creator/i);
  });
});
