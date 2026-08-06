/**
 * Local converted OBS-TF markdown bundles (PDF → MD), shipped for Workers.
 */

import idBundle from "../../data/obs-tf-md/id/bundle.json";

export interface LocalObsTfBundle {
  language: string;
  stories: Record<string, string>;
  transclusions: Record<string, string>;
}

const BUNDLES: Record<string, LocalObsTfBundle> = {
  id: idBundle as LocalObsTfBundle,
};

export function getLocalObsTfBundle(
  language: string,
): LocalObsTfBundle | null {
  const code = language.toLowerCase().split("-")[0];
  return BUNDLES[code] ?? null;
}

export function hasLocalObsTfStory(
  language: string,
  storyNum: number,
): boolean {
  const bundle = getLocalObsTfBundle(language);
  return Boolean(bundle?.stories?.[String(storyNum)]?.trim());
}

export function getLocalStoryMarkdown(
  language: string,
  storyNum: number,
): string | null {
  const bundle = getLocalObsTfBundle(language);
  const md = bundle?.stories?.[String(storyNum)];
  return md?.trim() ? md : null;
}

export function getLocalTransclusionMap(
  language: string,
): Map<string, string> {
  const bundle = getLocalObsTfBundle(language);
  const map = new Map<string, string>();
  if (!bundle) return map;
  for (const [file, content] of Object.entries(bundle.transclusions ?? {})) {
    map.set(file, content);
    map.set(file.replace(/\.md$/i, ""), content);
  }
  return map;
}
