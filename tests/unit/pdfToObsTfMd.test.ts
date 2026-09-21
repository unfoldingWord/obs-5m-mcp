import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  convertPdfTextToObsTfMd,
  countTranslationTerms,
  splitTranslationTerms,
  stripYamlFrontmatter,
} from "../../src/content/pdfToObsTfMd.js";
import { parseObsTfStoryMarkdown } from "../../src/content/obsTfParser.js";
import {
  compareStructures,
  loadStructureMap,
} from "../../src/content/structureMap.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function tryLoadStory2Input(): string | null {
  const plain = path.join(root, "exports/pdf-plain-md/OBS_2_Indonesia.plain.md");
  if (existsSync(plain)) {
    return stripYamlFrontmatter(readFileSync(plain, "utf8"));
  }
  const txt = path.join(root, "data/indonesian-text/02.txt");
  if (existsSync(txt)) return readFileSync(txt, "utf8");
  return null;
}

describe("pdfToObsTfMd + structure compare", () => {
  const pdfText = tryLoadStory2Input();
  const dcsMd = readFileSync(
    path.join(root, "tests/fixtures/en_obs_tf/obs_story_1.md"),
    "utf8",
  );
  const describeStory2 = pdfText ? describe : describe.skip;

  it("strips YAML frontmatter from plain MD", () => {
    const raw = "---\ntitle: x\n---\n\n0.1 Pokok Pikiran Utama\nHello\n";
    expect(stripYamlFrontmatter(raw)).toBe("0.1 Pokok Pikiran Utama\nHello\n");
  });

  describeStory2("story 2 conversion (needs local PDF extract)", () => {
    const text = pdfText as string;
  it("converts story 2 with inline community + shared movement TX links", () => {
    const { storyMarkdown, transclusions } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: text,
      dcsReferenceMd: dcsMd.replace(/story_num: 1/, "story_num: 2"),
    });
    const parsed = parseObsTfStoryMarkdown(storyMarkdown);
    expect(parsed.meta.storyNum).toBe(2);
    expect(parsed.frames.length).toBe(12);
    expect(parsed.communityStudyRef).toBeNull();
    expect(parsed.inlineCommunityStudy).toBeTruthy();
    expect(storyMarkdown).toMatch(/^#\s+Studi Komunitas:/m);
    expect(storyMarkdown).not.toContain("![[community_study_story_2]]");
    expect(transclusions["community_study_story_2.md"]).toBeUndefined();
    expect(parsed.movements[0]?.observation?.length).toBeGreaterThan(0);
    expect(parsed.movements[0]?.translation?.length).toBeGreaterThan(0);
    expect(parsed.movements[1]?.discourse?.length).toBeGreaterThan(0);
    expect(parsed.movements[1]?.theological?.length).toBeGreaterThan(0);
    expect(parsed.movements[2]?.journal?.length).toBeGreaterThan(0);
    expect(transclusions["movement_4.md"]).toBeTruthy();
    expect(storyMarkdown).toMatch(/^## Penafsiran Alkitab/m);
    expect(storyMarkdown).toMatch(/^### Pertanyaan[- ]*Pertanyaan(?:-)?\s*Observasi/m);
    expect(storyMarkdown).not.toMatch(/^##\s+\d+\b/m);
    expect(storyMarkdown).not.toContain("## Biblical Interpretation:");
    expect(storyMarkdown).toContain("![[movement_2_drafting]]");
    expect(storyMarkdown).toContain("![[conclusion]]");
  });

  it("attaches DCS frame images when reference is supplied", () => {
    const { storyMarkdown } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: text,
      dcsReferenceMd: dcsMd,
    });
    // Story 1 DCS images won't match 02-xx ids; ensure converter still emits frames
    expect(storyMarkdown).toMatch(/######### 02-01/);
  });

  it("compareStructures flags missing observation", () => {
    const map = loadStructureMap("id");
    const { storyMarkdown } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: text,
    });
    const stripped = storyMarkdown.replace(
      /### (?:Observation Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*Observasi|2\.1\b)[^\n]*[\s\S]*?(?=### (?:Translation Questions|Pertanyaan[- ]*Pertanyaan(?:-)?\s*(?:Penerjemahan|terjemahan)|2\.2\b))/i,
      (match) => {
        const heading =
          /^(###[^\n]+)/.exec(match)?.[1] ?? "### Observation Questions";
        return `${heading}\n\n`;
      },
    );
    const ref = storyMarkdown;
    const cmp = compareStructures(stripped, ref, map);
    expect(cmp.ok).toBe(false);
    expect(cmp.mismatches.some((m) => m.check === "hasObservation")).toBe(
      true,
    );
  });

  it("compareStructures accepts matching converted vs itself", () => {
    const map = loadStructureMap("id");
    const { storyMarkdown } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: text,
    });
    const cmp = compareStructures(storyMarkdown, storyMarkdown, map);
    expect(cmp.ok).toBe(true);
    expect(cmp.converted.hasCommunityStudy).toBe(true);
  });
  });

  it("loads structure map: Indonesian ids mapped to English titles/positions", () => {
    const map = loadStructureMap("id");
    expect(map.referenceRepo).toBe("en_obs_tf");
    expect(map.sections.find((s) => s.id === "0")?.enTitle).toBe("Introduction");
    expect(map.sections.find((s) => s.id === "2")?.enTitle).toMatch(
      /Biblical Interpretation/,
    );
    expect(map.sections.find((s) => s.id === "2.1")?.enTitle).toBe(
      "Observation Questions",
    );
    expect(map.cues.storyFrames).toMatch(/0\\.4/);
    expect(map.cues.keyIdea).toMatch(/0\\.1/);
    expect(map.cues.biblicalInterpretation).toContain("2(?!");
    expect(dcsMd).toContain("Open Bible Stories");
  });

  it("does not treat bare page numbers as community/biblical cues", () => {
    const txtPath = path.join(root, "data/indonesian-text/03.txt");
    if (!existsSync(txtPath)) return;
    const txt = readFileSync(txtPath, "utf8");
    const { storyMarkdown, transclusions } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 3,
      pdfText: txt,
    });
    expect(transclusions["community_study_story_3.md"]).toBeUndefined();
    expect(storyMarkdown).toMatch(/^#\s+Studi Komunitas:/m);
    expect(storyMarkdown).toMatch(/^## Penafsiran/m);
    expect(storyMarkdown).not.toContain(
      "After reading the crafted biblical story",
    );
    expect(storyMarkdown).not.toContain("Use the following discourse questions");
    expect(storyMarkdown).not.toMatch(/^title: Open Bible Stories$/m);
  });

  it("splitTranslationTerms keeps Term. blocks bounded by ?", () => {
    const body = `
Allah. Istilah Allah merujuk pada makhluk abadi yang menciptakan alam semesta dari kekosongan. Allah ada sebagai Bapa, Anak, dan Roh Kudus. Kata-kata apa dalam bahasa Anda yang mengartikan Allah sebagai pencipta yang kekal, berkuasa, dan tertinggi dari segala sesuatu?
Pada mulanya. Allah selalu ada, bahkan sebelum semua ciptaan. Dunia tidak selalu ada. Bagaimana Anda mengartikan pada mulanya yang berarti permulaan dari segala sesuatu (sebelum segala sesuatu ada kecuali Allah)?
Menciptakan. Allah menciptakan segala sesuatu dari kekosongan. Kata-kata apa dalam bahasa Anda yang berarti menciptakan seperti dalam kalimat Allah menciptakan segala sesuatu dari kekosongan?
Jadilah terang. Allah menciptakan segala sesuatu dengan mengucapkan perintah. Bagaimana Anda mengungkapkan Jadilah terang yang berarti Allah memerintahkan terang itu ada?
Terang itu jadi. Ketika Allah memerintahkan terang itu jadi, maka terang itu pun terjadi. Bagaimana Anda mengungkapkan terang itu jadi, yang berarti bahwa terang itu ada karena perintah Allah?
`;
    const terms = splitTranslationTerms(body);
    expect(terms.map((t) => t.term)).toEqual([
      "Allah",
      "Pada mulanya",
      "Menciptakan",
      "Jadilah terang",
      "Terang itu jadi",
    ]);
    expect(terms[0]?.guidance).toMatch(/Istilah Allah/);
    expect(terms[0]?.guidance).toMatch(/\?$/);
    // Must not invent mid-sentence false terms
    expect(terms.map((t) => t.term)).not.toContain("Ketika Allah");
    expect(terms.map((t) => t.term)).not.toContain("Allah ada sebagai Bapa");
  });

  it("splitTranslationTerms keeps periodless term lines", () => {
    const body = `
Taatilah Aku dan peliharalah perjanjian
Allah memerintahkan bangsa Israel untuk melakukan apa yang dituntut oleh perjanjian Allah untuk mereka lakukan.
Bagaimana Anda mengungkapkan taatilah Aku dan peliharalah perjanjian sebagai perintah yang Allah perintahkan kepada umat-Nya?
Jika kamu melakukan hal ini
Kata jika memperkenalkan sebuah pernyataan bersyarat.
Bagaimana Anda mengungkapkan Jika kamu melakukan ini untuk mengartikan bahwa Israel akan menjadi harta kesayangan Allah?
menuntun mereka Allah menunjukkan jalan kepada mereka dengan membuat tiang itu bergerak di depan mereka sehingga mereka dapat mengikutinya. Bagaimana Anda mengungkapkan menuntun mereka berarti Allah menunjukkan jalan?
Jika ia tidak melepaskan mereka Kata jika berarti bahwa sesuatu akan terjadi jika sesuatu yang lain terjadi terlebih dahulu. Bagaimana anda akan mengungkapkan jika ia tidak melepaskan mereka?
`;
    const terms = splitTranslationTerms(body);
    expect(terms.map((t) => t.term)).toEqual([
      "Taatilah Aku dan peliharalah perjanjian",
      "Jika kamu melakukan hal ini",
      "menuntun mereka",
      "Jika ia tidak melepaskan mereka",
    ]);
    expect(terms[0]?.guidance).toMatch(/Allah memerintahkan/);
    expect(terms[0]?.guidance).toMatch(/\?$/);
    expect(terms[2]?.guidance).toMatch(/tiang itu bergerak/);
  });

  it("keeps full observation questions (not mid-Apa truncation)", () => {
    const sample = `
### 0.1 Pokok Pikiran Utama
Key idea text here for length.
### 0.2 Ayat Pengakuan Iman
Verse text here.
### 0.3 Rangkuman Metanarasi
Meta text here.
### 0.4 Cerita Alkitab Terbuka: Sample
**02-01**
Frame one body here for the story.
## 1 Studi Komunitas: Sample Study
Community body text
## 2 Penafsiran Alkitabiah: Detail
Intro biblical
### 2.1 Pertanyaan-Pertanyaan Observasi
**02-01**
Kehidupan seperti apa yang dimiliki Adam dan istrinya di taman?
Adam dan istrinya bahagia dan telanjang.
Ke mana Allah memimpin mereka setelah itu?
Allah memimpin mereka ke sebuah gunung.
### 2.2 Pertanyaan-Pertanyaan Penerjemahan
**02-01**
Engkau terkutuk! Allah mengucapkan kutukan kepada ular itu. Kutukan berarti bahaya. Bagaimana Anda akan mengungkapkan Engkau terkutuk yang berarti kutukan?
## 3 Dialog Teologis: Meaning
Intro dialogue here
### 3.1 Pertanyaan-pertanyaan Diskursus
Bagaimana Allah menciptakan? (02-01)
Allah menciptakan segala sesuatu. (02-01)
### 3.2 Pertanyaan-pertanyaan Teologis
Jawablah pertanyaan-pertanyaan teologi berikut ini dalam sebuah komunitas.
1. What about God?
### 3.3 Naskah Awal Terjemahan
Draft notes
## 4 Refleksi Pribadi: Follow
Intro reflection
### 4.1 Refleksi Jurnal
Renungkanlah pertanyaan-pertanyaan refleksi pribadi berikut ini.
1. How do you respond?
## 5 Praktik Pelayanan: Serve
Ministry
## 6 Penjangkauan Misi: Share
Mission
## 7 Kesimpulan
Done
`;
    const { storyMarkdown, transclusions } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: sample,
    });
    expect(storyMarkdown).toContain(
      "Kehidupan seperti apa yang dimiliki Adam dan istrinya di taman?",
    );
    expect(storyMarkdown).toContain("Ke mana Allah memimpin mereka setelah itu?");
    expect(storyMarkdown).toContain("**Engkau terkutuk**");
    expect(storyMarkdown).toContain(
      "Jawablah pertanyaan-pertanyaan teologi berikut ini",
    );
    expect(transclusions["conclusion.md"]).toBeTruthy();
  });

  it("uses Indonesian observation/translation intros from plain MD", () => {
    const plain1 = path.join(
      root,
      "exports/pdf-plain-md/OBS_1_Indonesia.plain.md",
    );
    if (!existsSync(plain1)) return;
    const { storyMarkdown } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 1,
      pdfText: stripYamlFrontmatter(readFileSync(plain1, "utf8")),
    });
    expect(storyMarkdown).toMatch(/^## Pengantar/m);
    expect(storyMarkdown).toMatch(/^### Pokok Pikiran Utama/m);
    expect(storyMarkdown).toMatch(
      /^## Penafsiran Alkitabiah: Mengamati Detail Cerita/m,
    );
    expect(storyMarkdown).toMatch(
      /^### Pertanyaan-Pertanyaan Observasi\n\nJawablah pertanyaan/m,
    );
    expect(storyMarkdown).toMatch(
      /^### Pertanyaan-Pertanyaan Penerjemahan\n\nGunakan pertanyaan/m,
    );
    expect(storyMarkdown).not.toMatch(/^##?\s+\d+(\.\d+)?\s/m);
    expect(storyMarkdown).not.toContain("## Biblical Interpretation:");
    expect(storyMarkdown).not.toContain("### Key Idea");
    expect(storyMarkdown).not.toContain(
      "Answer the following observation questions to gain a basic understanding",
    );
    const counts = countTranslationTerms(storyMarkdown);
    expect(counts.perFrame["01-01"]).toBeGreaterThanOrEqual(4);
    expect(counts.perFrame["01-02"]).toBeGreaterThanOrEqual(4);
    expect(counts.perFrame["01-04"]).toBeGreaterThanOrEqual(1);
    expect(counts.perFrame["01-11"]).toBeGreaterThanOrEqual(1);
    expect(counts.fragmentedFrames.filter((id) => counts.perFrame[id] === 0)).toEqual(
      [],
    );
    expect(storyMarkdown).toContain("**Allah**");
    expect(storyMarkdown).toContain("**Jadilah terang**");
    // DCS shape: term then guidance — must not invent mid-sentence bold fragments
    expect(storyMarkdown).not.toMatch(
      /\*\*menciptakan segala sesuatu dengan mengucapkan perintah\*\*/i,
    );
    expect(storyMarkdown).toContain(
      "**Hendaklah air berkumpul pada satu tempat, dan tampaklah tanah yang kering**",
    );
  });

  it("parses **NN-NN** frame markers from plain MD", () => {
    const sample = `
### 0.1 Pokok Pikiran Utama
Key idea text.
### 0.2 Ayat Pengakuan Iman
Verse text.
### 0.3 Rangkuman Metanarasi
Meta text.
### 0.4 Cerita Alkitab Terbuka: Sample
**02-01**
Frame one body here.
**02-02**
Frame two body here.
Sebuah Cerita Alkitab dari: Kejadian 1
## 1 Studi Komunitas: Sample Study
Community body
## 2 Penafsiran Alkitabiah: Detail
Intro
### 2.1 Pertanyaan-Pertanyaan Observasi
**02-01**
Where from?
God.
### 2.2 Pertanyaan-Pertanyaan Penerjemahan
**02-01**
Allah. Term guidance about God here.
## 3 Dialog Teologis: Meaning
Intro dialogue
### 3.1 Pertanyaan-pertanyaan Diskursus
Bagaimana Allah menciptakan? (02-01)
Allah menciptakan segala sesuatu. (02-01)
### 3.2 Pertanyaan-pertanyaan Teologis
1. What about God?
2. What about humans?
### 3.3 Naskah Awal Terjemahan
Draft notes
## 4 Refleksi Pribadi: Follow
Intro reflection
### 4.1 Refleksi Jurnal
1. How do you respond?
### 4.2 Pemeriksaan Tim
Check notes
## 5 Praktik Pelayanan: Serve
Ministry
## 6 Penjangkauan Misi: Share
Mission
## 7 Kesimpulan
Done
`;
    const { storyMarkdown, transclusions } = convertPdfTextToObsTfMd({
      language: "id",
      storyNum: 2,
      pdfText: sample,
    });
    const parsed = parseObsTfStoryMarkdown(storyMarkdown);
    expect(parsed.frames.map((f) => f.id)).toEqual(["02-01", "02-02"]);
    expect(parsed.frames[0]?.text).toContain("Frame one");
    expect(storyMarkdown).not.toContain("![[community_study_story_2]]");
    expect(storyMarkdown).toMatch(/^#\s+Studi Komunitas:/m);
    expect(storyMarkdown).toContain("Community body");
    expect(transclusions["community_study_story_2.md"]).toBeUndefined();
  });
});
