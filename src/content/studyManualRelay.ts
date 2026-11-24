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
const QUESTION_MARK = /[?？؟]$/;

type ObsItem = { question: string; answer?: string };

function relayId(
  language: string,
  frameId: string,
  kind: "text" | "observation",
): string | null {
  const id = `obs-${language}-${frameId}-${kind}`;
  return RELAY_ID.test(id) ? id : null;
}

/**
 * Trust a frame only when every item still looks like a real Q/A pair.
 * Multi-line answers make parseFrameQaBlocks promote answer lines to
 * `question`, so those frames must not become relay blocks.
 */
export function isTrustedObservation(items: ObsItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((item) => {
    const question = item.question.trim();
    const answer = item.answer?.trim() ?? "";
    return answer.length > 0 && QUESTION_MARK.test(question);
  });
}

/**
 * Observation and frame-text blocks for the worker relay path.
 * Order: story order; for the same frame, text before observation.
 * Omit a block when its id would be invalid (e.g. a language code with spaces).
 */
export function buildStudyManualRelayBlocks(
  payload: StudyManualPayload,
): RelayBlock[] {
  const language = payload.language;
  const wantText = payload.part === "full" || payload.part === "frames";

  const obsByFrame = new Map<string, ObsItem[]>();
  for (const m of payload.movements) {
    if (m.id !== 1 || !m.observation) continue;
    for (const block of m.observation) {
      if (block.items.length === 0) continue;
      const prev = obsByFrame.get(block.frameId);
      obsByFrame.set(
        block.frameId,
        prev ? [...prev, ...block.items] : [...block.items],
      );
    }
  }

  const blocks: RelayBlock[] = [];
  const seenObs = new Set<string>();
  const seenText = new Set<string>();

  const pushText = (frameId: string, text: string) => {
    if (!wantText) return;
    if (!text.trim()) return;
    const id = relayId(language, frameId, "text");
    if (!id || seenText.has(id)) return;
    seenText.add(id);
    blocks.push({ id, text });
  };

  const pushObs = (frameId: string) => {
    const items = obsByFrame.get(frameId);
    if (!items?.length || seenObs.has(frameId)) return;
    if (!isTrustedObservation(items)) return;
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
