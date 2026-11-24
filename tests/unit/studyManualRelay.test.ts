import { describe, expect, it } from "vitest";
import { parseObsTfReference } from "../../src/content/obsTfReference.js";
import {
  buildStudyManualPayload,
  type StudyManualPayload,
} from "../../src/content/studyManual.js";
import {
  buildStudyManualRelayBlocks,
  type RelayBlock,
} from "../../src/content/studyManualRelay.js";
import { loadStory1 } from "../fixtures/loadStory1.js";

const DISTINCTIVE_ANSWER = "DISTINCTIVE_ANSWER_NEVER_IN_RELAY_ζύγος";

function syntheticPayload(
  overrides: Partial<StudyManualPayload> = {},
): StudyManualPayload {
  const base = buildStudyManualPayload(loadStory1(), {
    ref: parseObsTfReference("1:5")!,
    part: "full",
  });
  return {
    ...base,
    frames: [
      {
        id: "01-05",
        index: 5,
        imageRef: "image6.jpeg",
        text: "On the third day God created trees and plants — café, naïve, «guillemets».",
      },
    ],
    movements: [
      {
        id: 1,
        title: "Biblical Interpretation",
        observation: [
          {
            frameId: "01-05",
            items: [
              {
                question: "¿Qué creó Dios el tercer día?",
                answer: DISTINCTIVE_ANSWER,
              },
              {
                question: 'He said, "Let the earth produce…"',
                answer: `${DISTINCTIVE_ANSWER}-2`,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("buildStudyManualRelayBlocks", () => {
  it("omits every answer string from observation block text", () => {
    const blocks = buildStudyManualRelayBlocks(syntheticPayload(), "en");
    const obs = blocks.find((b) => b.id.endsWith("-observation"));
    expect(obs).toBeDefined();
    expect(obs!.text).not.toContain(DISTINCTIVE_ANSWER);
    expect(obs!.text).not.toContain(`${DISTINCTIVE_ANSWER}-2`);
  });

  it("keeps each question and frame text byte-identical, including non-ASCII", () => {
    const payload = syntheticPayload();
    const blocks = buildStudyManualRelayBlocks(payload, "en");
    const text = blocks.find((b) => b.id === "obs-en-01-05-text");
    const obs = blocks.find((b) => b.id === "obs-en-01-05-observation");
    expect(text!.text).toBe(payload.frames[0].text);
    expect(obs!.text).toBe(
      [
        "- ¿Qué creó Dios el tercer día?",
        '- He said, "Let the earth produce…"',
      ].join("\n"),
    );
  });

  it("emits stable unique ids; whole story has one observation block per framed questions", () => {
    const payload = buildStudyManualPayload(loadStory1(), {
      ref: parseObsTfReference("1")!,
      part: "full",
    });
    const blocks = buildStudyManualRelayBlocks(payload, "en");
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const obsIds = ids.filter((id) => id.endsWith("-observation"));
    expect(obsIds).toHaveLength(16);
    expect(obsIds[0]).toBe("obs-en-01-01-observation");
    expect(obsIds[15]).toBe("obs-en-01-16-observation");
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    }
  });

  it("orders story order with text before observation for the same frame", () => {
    const blocks = buildStudyManualRelayBlocks(syntheticPayload(), "en");
    expect(blocks.map((b) => b.id)).toEqual([
      "obs-en-01-05-text",
      "obs-en-01-05-observation",
    ]);
  });

  it("part=movement1 yields observation blocks only", () => {
    const payload = buildStudyManualPayload(loadStory1(), {
      ref: parseObsTfReference("1")!,
      part: "movement1",
    });
    const blocks = buildStudyManualRelayBlocks(payload, "en");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => b.id.endsWith("-observation"))).toBe(true);
  });

  it("part=frames yields text blocks only", () => {
    const payload = buildStudyManualPayload(loadStory1(), {
      ref: parseObsTfReference("1")!,
      part: "frames",
    });
    const blocks = buildStudyManualRelayBlocks(payload, "en");
    expect(blocks).toHaveLength(16);
    expect(blocks.every((b) => b.id.endsWith("-text"))).toBe(true);
    expect(blocks[0].text).toBe(payload.frames[0].text);
  });

  it("part=intro yields no blocks", () => {
    const payload = buildStudyManualPayload(loadStory1(), {
      ref: parseObsTfReference("1")!,
      part: "intro",
    });
    expect(buildStudyManualRelayBlocks(payload, "en")).toEqual([]);
  });

  it("skips a block when the language would break the id pattern", () => {
    const blocks = buildStudyManualRelayBlocks(syntheticPayload(), "en bad");
    expect(blocks).toEqual([]);
  });

  it("skips a frame with no observation questions", () => {
    const payload = syntheticPayload({
      frames: [
        {
          id: "01-03",
          index: 3,
          imageRef: "x.jpeg",
          text: "Sky only.",
        },
      ],
      movements: [
        {
          id: 1,
          title: "Biblical Interpretation",
          observation: [{ frameId: "01-03", items: [] }],
        },
      ],
      part: "full",
    });
    const blocks = buildStudyManualRelayBlocks(payload, "en");
    expect(blocks.map((b: RelayBlock) => b.id)).toEqual(["obs-en-01-03-text"]);
  });
});
