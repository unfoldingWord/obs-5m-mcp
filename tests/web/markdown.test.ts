import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../web/src/lib/markdown.js";

describe("renderMarkdown", () => {
  it("removes scripts and event handlers", () => {
    expect(renderMarkdown("<img src=x onerror=alert(1)>")).not.toMatch(/onerror/i);
    expect(renderMarkdown("<script>x</script> hi")).not.toMatch(/<script/i);
    expect(renderMarkdown("[a](javascript:alert(1))")).not.toMatch(/javascript:/i);
  });

  it("keeps the manual's structure", () => {
    const html = renderMarkdown("#### 01-05\n\n- **Q:** a");
    expect(html).toMatch(/<h4[^>]*>01-05<\/h4>/);
    expect(html).toMatch(/<li>.*<strong>Q:<\/strong> a.*<\/li>/s);
  });

  it("opens links in a new tab", () => {
    expect(renderMarkdown("[Door43](https://door43.org)")).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/);
  });
});
