/** Landing page for the Worker-served MCP website. */

import { siteCss, siteHeader } from "./siteStyles.js";

export function renderHomePage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ezer · OBS Five Movements MCP</title>
  <meta name="description" content="MCP server for Open Bible Stories + Theological Formation — AI agents that lead translator study sessions." />
  <style>${siteCss()}</style>
</head>
<body>
  ${siteHeader(base, "home")}
  <main>
    <h2 style="margin-top:0">Study tools for AI-led translation sessions</h2>
    <p class="lead">
      Meet <strong>Ezer</strong> (Hebrew for “helper”) — the same coach brand as Translation Helps,
      specialized for OBS Five Movements: observe, discuss, draft, check, serve, and share
      using the official study questions.
      Open the chat at <a href="${base}/chat"><code>/chat</code></a>.
    </p>

    <p>
      <a class="cta" href="${base}/docs">Read the agent guide</a>
      <a class="cta secondary" href="${base}/chat">Try the chat UI</a>
    </p>

    <div class="grid">
      <div class="card">
        <h3>For translators</h3>
        <p class="muted">
          Ask for the next movement in plain language. The agent fetches the right
          Indonesian or English study slice so your team stays on the process,
          not buried in a long PDF.
        </p>
      </div>
      <div class="card">
        <h3>For agents &amp; integrators</h3>
        <p class="muted">
          Use <code>fetch_obs_study_manual</code> with <code>part</code> and
          <code>sessionFlow</code>. Content is packaging-resolved
          (shared templates and story-unique text look the same).
        </p>
      </div>
    </div>

    <h2>Connect</h2>
    <table>
      <tbody>
        <tr><td>MCP</td><td><a href="${base}/mcp"><code>${base}/mcp</code></a></td></tr>
        <tr><td>Agent guide</td><td><a href="${base}/docs"><code>/docs</code></a></td></tr>
        <tr><td>Chat</td><td><a href="${base}/chat"><code>/chat</code></a></td></tr>
        <tr><td>X-ray tools</td><td><a href="${base}/debug"><code>/debug</code></a></td></tr>
        <tr><td>Manifest JSON</td><td><a href="${base}/api/mcp-manifest"><code>/api/mcp-manifest</code></a></td></tr>
        <tr><td>API discovery</td><td><a href="${base}/api"><code>/api</code></a></td></tr>
        <tr><td>Health</td><td><a href="${base}/health"><code>/health</code></a></td></tr>
      </tbody>
    </table>

    <footer>
      obs-5m-mcp · CC BY-SA 4.0 study content · Five Movements framework from unfoldingWord
    </footer>
  </main>
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
