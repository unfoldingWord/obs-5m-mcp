import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  locateStructureSections,
  findLastSectionId,
  headingFromLocated,
  titleFromSourceHeading,
} from "../../src/content/sectionLocator.js";
import { loadStructureMap } from "../../src/content/structureMap.js";
import { stripYamlFrontmatter } from "../../src/content/pdfToObsTfMd.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("sectionLocator — id → English slot, title after id", () => {
  it("maps story 1 plain MD section ids to English slots with ID titles", () => {
    const plain = path.join(
      root,
      "exports/pdf-plain-md/OBS_1_Indonesia.plain.md",
    );
    if (!existsSync(plain)) return;
    const text = stripYamlFrontmatter(readFileSync(plain, "utf8"));
    const map = loadStructureMap("id");
    const located = locateStructureSections(text, map.sections);

    expect(located.get("intro")?.sourceTitle).toMatch(/^0\s+Pengantar/);
    expect(located.get("intro")?.enTitle).toBe("Introduction");
    expect(located.get("intro")?.level).toBe(2);

    expect(located.get("keyIdea")?.sourceTitle).toMatch(/^0\.1\s+/);
    expect(located.get("keyIdea")?.enTitle).toBe("Key Idea");

    expect(located.get("biblicalInterpretation")?.sourceTitle).toMatch(
      /^2\s+Penafsiran/,
    );
    expect(located.get("biblicalInterpretation")?.enTitle).toMatch(
      /Biblical Interpretation/,
    );

    expect(located.get("communityStudy")?.sourceTitle).toMatch(
      /^1\s+Studi Komunitas:/,
    );
    expect(located.get("conclusion")?.sourceTitle).toMatch(/^7\s+Kesimpulan/);
  });

  it("prefers real chapter 2 over verse line '2 Sekalipun…' (story 8)", () => {
    const plain = path.join(
      root,
      "exports/pdf-plain-md/OBS_8_Indonesia.plain.md",
    );
    if (!existsSync(plain)) return;
    const text = stripYamlFrontmatter(readFileSync(plain, "utf8"));
    const map = loadStructureMap("id");
    const located = locateStructureSections(text, map.sections);
    expect(located.get("biblicalInterpretation")?.sourceTitle).toMatch(
      /^2\s+Penafsiran/,
    );
    expect(located.get("biblicalInterpretation")?.sourceTitle).not.toMatch(
      /Sekalipun/,
    );
  });

  it("findLastSectionId picks last major before subsection", () => {
    const sample = `
## 1 Studi Komunitas: Test
### 2 Sekalipun aku mempunyai karunia
### 1.5 Something
## 2 Penafsiran Alkitabiah: Detail
### 2.1 Pertanyaan
`;
    const before21 = sample.indexOf("### 2.1");
    const last = findLastSectionId(sample, "2", 0, before21);
    expect(sample.slice(last, last + 40)).toMatch(/2 Penafsiran/);
  });

  it("strips section ids from emitted markdown headings", () => {
    expect(titleFromSourceHeading("2 Penafsiran Alkitabiah: Detail", "2")).toBe(
      "Penafsiran Alkitabiah: Detail",
    );
    expect(titleFromSourceHeading("0.1 Pokok Pikiran Utama", "0.1")).toBe(
      "Pokok Pikiran Utama",
    );
    const located = {
      key: "biblicalInterpretation",
      id: "2",
      enTitle: "Biblical Interpretation",
      level: 2,
      sourceTitle: "2 Penafsiran Alkitabiah: Mengamati Detail Cerita",
      index: 0,
      bodyStart: 10,
    };
    expect(headingFromLocated(located, "fallback")).toBe(
      "## Penafsiran Alkitabiah: Mengamati Detail Cerita",
    );
  });
});
