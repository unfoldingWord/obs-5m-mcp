import { describe, expect, it } from "vitest";
import { curlFor } from "../../web/src/lib/try/copyAs.js";
import { validPanels } from "../../web/src/lib/try/panels.js";
import { renderedView } from "../../web/src/lib/try/rendered.js";

const exchange = { request: {}, response: {}, status: 200, bytes: 1, ms: 1 };

describe("curl copy opens a session first", () => {
  it("initializes, keeps the session id, then calls the tool", () => {
    const cmd = curlFor("https://x/mcp", "list_stories", {});
    expect(cmd).toContain('"method":"initialize"');
    expect(cmd).toContain("Mcp-Session-Id");
    // The server keeps each SSE stream open, so both commands need a time limit.
    expect(cmd.match(/--max-time/g)).toHaveLength(2);
    expect(cmd.indexOf('"method":"initialize"')).toBeLessThan(cmd.indexOf('"method":"tools/call"'));
  });
});

describe("panel input", () => {
  it("accepts ranges only when the server supports them", () => {
    expect(validPanels("", false)).toBe(true);
    expect(validPanels("5", false)).toBe(true);
    expect(validPanels("5-8", false)).toBe(false);
    expect(validPanels("5-8", true)).toBe(true);
    expect(validPanels("8-5", true)).toBe(false);
    expect(validPanels("x", true)).toBe(false);
  });
});

describe("rendered view of a result", () => {
  it("renders the manual's markdown when the answer carries it", () => {
    const view = renderedView({ text: "x", structured: { content: "# Story" }, isError: false, exchange });
    expect(view).toEqual({ kind: "markdown", text: "# Story" });
  });

  it("shows the summary line and formatted JSON for a JSON answer", () => {
    const view = renderedView({
      text: 'OBS study manual 4 (en) part=movement2\n\n{"a":1}',
      structured: { a: 1 },
      isError: false,
      exchange,
    });
    expect(view).toEqual({ kind: "json", summary: "OBS study manual 4 (en) part=movement2", json: '{\n  "a": 1\n}' });
  });

  it("renders the text as markdown when the server sends the manual as text (#17)", () => {
    const view = renderedView({
      text: "# The Creation (OBS 1:5)\n\n### Observation Questions",
      structured: { reference: "1:5", movements: [] },
      isError: false,
      exchange,
    });
    expect(view).toEqual({ kind: "markdown", text: "# The Creation (OBS 1:5)\n\n### Observation Questions" });
  });

  it("renders only the first block, not the note for the assistant", () => {
    const manual = "# The Creation (OBS 1:5)\n\n### Observation Questions";
    const note = "For the assistant (don't show this to the user):\nStory 1 · movement1 (4 of 11)";
    const view = renderedView({
      text: `${manual}\n\n${note}`,
      blocks: [manual, note],
      structured: { reference: "1:5", movements: [] },
      isError: false,
      exchange,
    });
    expect(view).toEqual({ kind: "markdown", text: manual });
  });

  it("shows plain text when there is no structured data", () => {
    const view = renderedView({ text: "Error RESOURCE_NOT_FOUND: nope", structured: null, isError: true, exchange });
    expect(view).toEqual({ kind: "text", text: "Error RESOURCE_NOT_FOUND: nope" });
  });
});
