/** Landing page for the Worker-served MCP website. */

import { renderMcpConnectSetup } from "./mcpConnectSetup.js";
import { heroVisualSvg, siteCss, siteFonts, siteFooter, siteHeader } from "./siteStyles.js";

export function renderHomePage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OBS-TF MCP · OBS Theological Formation</title>
  <meta name="description" content="OBS Theological Formation MCP — a Model Context Protocol server that exposes tools for Open Bible Stories + Five Movements study manuals. Part of the BT Servant ecosystem." />
  ${siteFonts()}
  <style>${siteCss()}</style>
</head>
<body>
  ${siteHeader(base, "home")}

  <section class="hero" aria-label="Introduction">
    <div class="hero-inner">
      <div class="hero-copy">
        <p class="hero-brand">OBS-TF<em> MCP</em></p>
        <h2>The OBS Theological Formation tool server</h2>
        <p class="hero-support">
          A Model Context Protocol server that lets AI assistants fetch Open Bible Stories + Five Movements study content — structured tools, not a standalone translation app.
        </p>
        <div class="hero-cta">
          <a class="cta" href="${base}/docs">Developer guide</a>
          <a class="cta secondary" href="${base}/docs#connect-heading">Setup config</a>
        </div>
      </div>
      <div class="hero-visual">
        ${heroVisualSvg()}
      </div>
    </div>
  </section>

  <div class="shell">
    <section class="section" aria-labelledby="mcp-heading">
      <p class="section-kicker">What is MCP?</p>
      <h2 id="mcp-heading" style="margin-top:0">A standard way for AI apps to call tools</h2>
      <p class="section-support">
        <strong>Model Context Protocol (MCP)</strong> is how AI clients — Claude, Cursor, custom coaches, BT Servant, and others — connect to a remote server and invoke structured tools. The client sends a tool name and arguments; the server returns typed data the model can ground on.
      </p>
      <div class="feature-grid">
        <div class="feature-item">
          <h3>Client</h3>
          <p>Any MCP-compatible assistant or app that can register a remote server URL.</p>
        </div>
        <div class="feature-item">
          <h3>Server</h3>
          <p>This Worker: exposes discovery and study-manual tools over <code>/mcp</code>.</p>
        </div>
        <div class="feature-item">
          <h3>Tools</h3>
          <p>Named operations with schemas — e.g. <code>fetch_obs_study_manual</code> — returning JSON or markdown.</p>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="provides-heading">
      <p class="section-kicker">This server</p>
      <h2 id="provides-heading" style="margin-top:0">What OBS-TF MCP provides</h2>
      <p class="section-support">
        Structured access to <strong>OBS Theological Formation</strong> manuals — paced
        observe → discuss → draft → check → serve → share sessions for Open Bible Stories (1–50).
      </p>
      <ul class="scenario-list">
        <li>
          <h3>Primary tool: <code>fetch_obs_study_manual</code></h3>
          <p>
            Story:frame keyed study content with optional <code>part</code> slices and a
            <code>sessionFlow</code> map for agent routing. Formats: <code>json</code>, <code>md</code>, <code>text</code>.
          </p>
        </li>
        <li>
          <h3>Discovery + helpers</h3>
          <p>
            <code>list_languages</code>, <code>list_resources</code>, <code>list_collections</code>,
            <code>list_stories</code>, <code>get_framework</code>, plus focused getters and
            <code>search_content</code>. Indonesian PDF download via <code>get_pdf</code> when needed.
          </p>
        </li>
        <li>
          <h3>Content sources</h3>
          <p>
            English from Door43 <code>en_obs_tf</code> (catalog
            <code>subject=OBS Theological Formation</code>, <code>topic=tc-ready</code>).
            Indonesian via converted/local content until DCS-published. Packaging
            (<code>![[transclusion]]</code> vs story-inline) is resolved for you.
          </p>
        </li>
      </ul>
    </section>

    <section class="section" aria-labelledby="who-heading">
      <p class="section-kicker">Audience</p>
      <h2 id="who-heading" style="margin-top:0">Who this is for</h2>
      <p class="section-support">
        Integrators and agent authors who need trustworthy OBS-TF content behind an MCP client —
        not end-user translation software.
      </p>
      <div class="split">
        <div>
          <h3>Integrators &amp; coaches</h3>
          <p>
            Wire <code>${base}/mcp</code> into BT Servant–style coaches, Claude Desktop
            (<code>mcp-remote</code>), Cursor, or any Streamable HTTP MCP client. Call tools;
            present the returned questions and instructions.
          </p>
        </div>
        <div>
          <h3>Agent developers</h3>
          <p>
            Follow the recommended tool loop: discover language → pick story → load framework →
            pace with <code>part=…</code>. See the <a href="${base}/docs">developer guide</a>
            for the full contract.
          </p>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="eco-heading">
      <p class="section-kicker">Ecosystem</p>
      <h2 id="eco-heading" style="margin-top:0">Sibling to Translation Helps MCP</h2>
      <p class="section-support">
        Part of the
        <a href="https://www.btservant.ai/" target="_blank" rel="noopener">BT Servant</a>
        ecosystem by unfoldingWord. Two servers, complementary jobs:
      </p>
      <div class="eco-note">
        <p>
          <strong>Translation Helps MCP</strong> —
          <a href="https://tc-helps.mcp.servant.bible/v2/" target="_blank" rel="noopener">tc-helps.mcp.servant.bible</a>
          — scripture text, TN / TW / TA / TQ, passage tools, and classic OBS helps.
        </p>
        <p>
          <strong>OBS-TF MCP</strong> — this server — OBS Theological Formation / Five Movements
          study manuals for translator and church formation sessions.
        </p>
      </div>
    </section>

    <section class="section" aria-labelledby="connect-heading">
      <p class="section-kicker">Connect</p>
      <h2 id="connect-heading" style="margin-top:0">Endpoints</h2>
      <p class="section-support">
        Point an MCP client at the server URL. Use the guide for tool contracts; chat and X-ray are optional demos.
      </p>
      <ul class="connect-list">
        <li><span class="label">MCP</span><a href="${base}/mcp">${base}/mcp</a></li>
        <li><span class="label">Guide</span><a href="${base}/docs">${base}/docs</a></li>
        <li><span class="label">Manifest</span><a href="${base}/api/mcp-manifest">${base}/api/mcp-manifest</a></li>
        <li><span class="label">Tool API</span><a href="${base}/api/tool">${base}/api/tool</a></li>
        <li><span class="label">Chat demo</span><a href="${base}/chat">${base}/chat</a></li>
        <li><span class="label">X-ray</span><a href="${base}/debug">${base}/debug</a></li>
        <li><span class="label">Health</span><a href="${base}/health">${base}/health</a></li>
      </ul>
      ${renderMcpConnectSetup(base)}
    </section>

    ${siteFooter()}
  </div>
</body>
</html>`;
}

export function apiDiscoveryJson(baseUrl: string, version: string, name: string) {
  const base = baseUrl.replace(/\/$/, "");
  return {
    name,
    version,
    mcp: "/mcp",
    docs: "/docs",
    home: "/",
    chat: "/chat",
    manifest: "/api/mcp-manifest",
    health: "/health",
    debug: "/debug",
    tool: "/api/tool",
    apiChat: "/api/chat",
    api: "/api",
    urls: {
      mcp: `${base}/mcp`,
      docs: `${base}/docs`,
      chat: `${base}/chat`,
    },
  };
}
