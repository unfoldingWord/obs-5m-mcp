/**
 * Self-hosted Indonesian PDF packs via R2 + committed manifest + extracted text.
 *
 * Text is produced by `npm run ingest:id` (unpdf) into data/indonesian-text.json
 * so tools can return study content when DCS has no OBS TF for the language.
 */

import indonesianManifest from "../../data/indonesian-manifest.json";
import indonesianText from "../../data/indonesian-text.json";

export interface IndonesianStoryEntry {
  story: number;
  title: string;
  r2Key: string;
  textR2Key?: string;
  filename?: string;
}

export interface IndonesianManifest {
  language: string;
  languageName: string;
  source: string;
  license: string;
  stories: IndonesianStoryEntry[];
}

type TextPack = {
  language: string;
  stories: Record<string, string>;
};

const textPack = indonesianText as TextPack;

export function getIndonesianManifest(): IndonesianManifest {
  return indonesianManifest as IndonesianManifest;
}

export function listIndonesianStories(): IndonesianStoryEntry[] {
  return getIndonesianManifest().stories;
}

export function getIndonesianStory(
  story: number,
): IndonesianStoryEntry | null {
  return listIndonesianStories().find((s) => s.story === story) ?? null;
}

export function hasIndonesianPdfs(): boolean {
  return listIndonesianStories().length > 0;
}

export function hasIndonesianText(story: number): boolean {
  return Boolean(textPack.stories?.[String(story)]?.trim());
}

/** Extracted plain text for a story (from ingest), or null. */
export function getIndonesianText(story: number): string | null {
  const t = textPack.stories?.[String(story)];
  return t?.trim() ? t : null;
}

/**
 * Build a public URL for a PDF. Prefers worker asset route when PUBLIC_BASE_URL is set.
 */
export function pdfPublicUrl(
  entry: IndonesianStoryEntry,
  publicBaseUrl: string,
): string {
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/assets/pdf/${encodeURIComponent(entry.r2Key)}`;
}

export function textR2KeyForStory(story: number): string {
  return `id/obs-tf/${String(story).padStart(2, "0")}.txt`;
}

export async function getPdfObject(
  bucket: R2Bucket | undefined,
  r2Key: string,
): Promise<R2ObjectBody | null> {
  if (!bucket) return null;
  return bucket.get(r2Key);
}
