import { describe, expect, it } from "vitest";
import {
  normalizeForCoverage,
  splitSourceChunks,
  wordWindows,
} from "../../scripts/check-pdf-content-coverage.js";

describe("content coverage helpers", () => {
  it("normalizes section ids and frame markers away", () => {
    const src = `
## 0 Pengantar
### 0.1 Pokok Pikiran Utama
**01-01**
Allah menciptakan.
`;
    const dest = `
---
title: Cerita Alkitab Terbuka
subtitle: Penciptaan
---
## Pengantar
### Pokok Pikiran Utama
######### 01-01
Allah menciptakan.
`;
    expect(normalizeForCoverage(src)).toContain("pengantar");
    expect(normalizeForCoverage(src)).toContain("pokok pikiran utama");
    expect(normalizeForCoverage(src)).toContain("01-01");
    expect(normalizeForCoverage(src)).toContain("allah menciptakan");
    expect(normalizeForCoverage(src)).not.toMatch(/\b0\.1\b/);
    expect(normalizeForCoverage(dest)).toContain("cerita alkitab terbuka");
    expect(normalizeForCoverage(dest)).toContain("penciptaan");
    expect(normalizeForCoverage(dest)).toContain("allah menciptakan");
  });

  it("builds sliding windows", () => {
    const n = "a b c d e f g h i j k";
    const wins = wordWindows(n, 4, 2);
    expect(wins[0]).toBe("a b c d");
    expect(wins).toContain("c d e f");
    expect(wins.at(-1)).toMatch(/h i j k|i j k/);
  });

  it("splits source on section boundaries", () => {
    const chunks = splitSourceChunks(`
# Cerita Alkitab Terbuka
## Penciptaan
## 0 Pengantar
Hello intro text here that is long enough for a chunk boundary test xx.
### 0.1 Pokok Pikiran Utama
Key idea text that is also long enough to survive the minimum chunk filter yy.
`);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
