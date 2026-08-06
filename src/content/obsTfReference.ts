/**
 * OBS story:frame reference parsing for study-manual tools.
 * Aligns with translation-helps-mcp OBS refs (issue #32 / #36).
 */

export interface ObsTfReference {
  story: number;
  /** null = whole story; 0 = title/intro; >=1 = frame */
  frame: number | null;
  canonical: string;
}

/**
 * Parse "1:1", "1", "01:02", "obs 1:1". Rejects "front" (no study manual).
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
    return { story, frame: null, canonical: `${story}` };
  }

  const match = /^(\d+):(\d+)(?:-(\d+))?$/.exec(s);
  if (!match) return null;
  const story = Number.parseInt(match[1], 10);
  const frame = Number.parseInt(match[2], 10);
  if (story < 1 || story > 50) return null;
  return { story, frame, canonical: `${story}:${frame}` };
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
