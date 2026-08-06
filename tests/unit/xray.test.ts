import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runWithXray } from "../../src/core/xray/context.js";
import { formatXrayReport } from "../../src/core/xray/formatReport.js";
import { XraySession } from "../../src/core/xray/traceEvents.js";
import { fetchStoryMarkdown } from "../../src/content/dcsFetcher.js";
import {
  emptyEnv,
  restoreFetch,
  stubDcsFetch,
} from "../helpers/mockDcsFetch.js";

describe("X-ray tracing", () => {
  beforeEach(() => stubDcsFetch());
  afterEach(() => restoreFetch());

  it("records dcs_fetch and cache events during story load", async () => {
    const session = new XraySession();
    await runWithXray(session, async () => {
      await fetchStoryMarkdown("en", 1, emptyEnv());
    });
    const events = session.done();
    expect(events.some((e) => e.type === "cache" && !e.hit)).toBe(true);
    expect(
      events.some((e) => e.type === "dcs_fetch" && e.kind === "story"),
    ).toBe(true);
    expect(events.some((e) => e.type === "done_trace")).toBe(true);
  });

  it("formatXrayReport includes tool and dcs sections", () => {
    const session = new XraySession();
    session.push({
      type: "tool_call",
      name: "fetch_obs_study_manual",
      params: { reference: "1:1" },
      ms: 12,
      ok: true,
      summary: "ok",
      downstreamApiCalls: 2,
    });
    session.push({
      type: "dcs_fetch",
      url: "https://git.door43.org/…/obs_story_1.md",
      status: 200,
      ms: 40,
      cache: "miss",
      kind: "story",
    });
    const report = formatXrayReport(session.done(), {
      tool: "fetch_obs_study_manual",
    });
    expect(report).toMatch(/obs-5m-mcp — X-ray debug report/);
    expect(report).toMatch(/fetch_obs_study_manual/);
    expect(report).toMatch(/dcsFetches: 1/);
    expect(report).toMatch(/tool_call/);
  });
});
