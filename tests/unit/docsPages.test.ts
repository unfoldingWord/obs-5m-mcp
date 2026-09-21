import { describe, expect, it } from "vitest";
import { renderAgentGuidePage } from "../../src/docs/agentGuidePage.js";
import { apiDiscoveryJson, renderHomePage } from "../../src/docs/homePage.js";

describe("docs pages", () => {
  it("home page links to docs and mcp", () => {
    const html = renderHomePage("http://localhost:8790");
    expect(html).toContain("/docs");
    expect(html).toContain("/mcp");
    expect(html).toContain("Agent guide");
  });

  it("agent guide explains sessionFlow and fetch_obs_study_manual", () => {
    const html = renderAgentGuidePage("http://localhost:8790");
    expect(html).toContain("fetch_obs_study_manual");
    expect(html).toContain("sessionFlow");
    expect(html).toContain('part": "checking"');
    expect(html).toContain("Agent rules");
    expect(html).toContain("drafting");
    expect(html).toContain('"url": "http://localhost:8790/mcp"');
  });

  it("api discovery includes docs URL", () => {
    const json = apiDiscoveryJson("http://localhost:8790", "0.1.0", "obs-5m-mcp");
    expect(json.docs).toBe("/docs");
    expect(json.urls.docs).toBe("http://localhost:8790/docs");
  });
});
