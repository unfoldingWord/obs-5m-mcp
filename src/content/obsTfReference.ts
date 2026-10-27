/**
 * OBS story:frame reference parsing for study-manual tools.
 * Aligns with translation-helps-mcp OBS refs (issue #32 / #36).
 */

export interface ObsTfReference {
  story: number;
  /** null = whole story; 0 = title/intro; >=1 = frame */
  frame: number | null;
  /** Last frame of a range ("1:5-8" → 8); null for a single frame or whole story. */
  frameEnd: number | null;
  canonical: string;
}

/**
 * Parse "1:1", "1:5-8", "1", "01:02", "obs 1:1". Rejects "front" (no study manual)
 * and ranges that run backwards ("1:8-5").
 */
export function parseObsTfReference(input: string): ObsTfReference | null {
  if (!input || typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (s.startsWith("obs ") || s.startsWith("obs:")) {
    s = s.slice(4).trim();
  }
  if (s === "front" || s === "front:intro") return null;

  const bare = /^(\d+)$/.exec(s);
  if (bare) {
    const story = Number.parseInt(bare[1], 10);
    if (story < 1 || story > 50) return null;
    return { story, frame: null, frameEnd: null, canonical: `${story}` };
  }

  const match = /^(\d+):(\d+)(?:-(\d+))?$/.exec(s);
  if (!match) return null;
  const story = Number.parseInt(match[1], 10);
  const frame = Number.parseInt(match[2], 10);
  if (story < 1 || story > 50) return null;
  if (match[3] === undefined) {
    return { story, frame, frameEnd: null, canonical: `${story}:${frame}` };
  }
  const end = Number.parseInt(match[3], 10);
  if (end < frame) return null;
  if (end === frame) {
    return { story, frame, frameEnd: null, canonical: `${story}:${frame}` };
  }
  return { story, frame, frameEnd: end, canonical: `${story}:${frame}-${end}` };
}

/** Frame index 1 → "01-01" style id prefix matching obs_tf headers. */
export function frameIdFor(story: number, frame: number): string {
  return `${String(story).padStart(2, "0")}-${String(frame).padStart(2, "0")}`;
}

export function matchesFrameId(frameId: string, story: number, frame: number): boolean {
  const want = frameIdFor(story, frame);
  if (frameId === want) return true;
  // Also accept unpadded "1-1"
  const loose = `${story}-${frame}`;
  return frameId === loose || frameId.replace(/^0+(\d)/, "$1").replace(/-0+(\d)/, "-$1") === loose;
}

/** True when `index` falls in the frame or frame range of `ref`. Whole-story and intro refs match every frame. */
export function frameInRef(ref: ObsTfReference, index: number): boolean {
  if (ref.frame === null || ref.frame === 0) return true;
  return index >= ref.frame && index <= (ref.frameEnd ?? ref.frame);
}

/** Frame index from an id like "01-05" or "1-5" in story `story`; null when the id is another story or not a frame id. */
export function frameIndexOf(frameId: string, story: number): number | null {
  const m = /^(\d+)-(\d+)$/.exec(frameId.trim());
  if (!m || Number.parseInt(m[1], 10) !== story) return null;
  return Number.parseInt(m[2], 10);
}
