/**
 * Verbatim relay blocks for fetch_obs_study_manual (bt-servant-worker#462).
 * Built from the study-manual payload so md/text (no movements in data) still
 * get the same blocks as json.
 */

import type { StudyManualPayload } from "./studyManual.js";

export interface RelayBlock {
  id: string;
  text: string;
}

const RELAY_ID = /^[A-Za-z0-9._-]{1,128}$/;

function relayId(
  language: string,
  frameId: string,
  kind: "text" | "observation",
): string | null {
  const id = `obs-${language}-${frameId}-${kind}`;
  return RELAY_ID.test(id) ? id : null;
}

/**
 * Observation and frame-text blocks for the worker relay path.
 * Order: story order; for the same frame, text before observation.
 * Omit a block when its id would be invalid (e.g. a language code with spaces).
 */
export function buildStudyManualRelayBlocks(
  payload: StudyManualPayload,
  language: string,
): RelayBlock[] {
  const wantText = payload.part === "full" || payload.part === "frames";

  const obsByFrame = new Map<
    string,
    Array<{ question: string; answer?: string }>
  >();
  for (const m of payload.movements) {
    if (m.id !== 1 || !m.observation) continue;
    for (const block of m.observation) {
      if (block.items.length > 0) obsByFrame.set(block.frameId, block.items);
    }
  }

  const blocks: RelayBlock[] = [];
  const seenObs = new Set<string>();

  const pushText = (frameId: string, text: string) => {
    if (!wantText) return;
    const id = relayId(language, frameId, "text");
    if (!id) return;
    blocks.push({ id, text });
  };

  const pushObs = (frameId: string) => {
    const items = obsByFrame.get(frameId);
    if (!items?.length || seenObs.has(frameId)) return;
    const id = relayId(language, frameId, "observation");
    if (!id) return;
    seenObs.add(frameId);
    blocks.push({
      id,
      text: items.map((item) => `- ${item.question}`).join("\n"),
    });
  };

  if (wantText) {
    for (const frame of payload.frames) {
      pushText(frame.id, frame.text);
      pushObs(frame.id);
    }
  }

  // Observation-only parts (e.g. movement1): frames are empty on the payload.
  for (const frameId of obsByFrame.keys()) {
    pushObs(frameId);
  }

  return blocks;
}
