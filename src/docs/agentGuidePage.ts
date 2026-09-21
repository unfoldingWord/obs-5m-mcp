/** Documentation: how developers and agents connect to and use OBS-TF MCP. */

import { renderMcpConnectSetup } from "./mcpConnectSetup.js";
import {
  guideIcon,
  guidePageScript,
  sessionFlowSvg,
  siteCss,
  siteFonts,
  siteFooter,
  siteHeader,
} from "./siteStyles.js";

export function renderAgentGuidePage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Developer guide · OBS-TF MCP</title>
  <meta name="description" content="Connect to OBS Theological Formation MCP: endpoints, tool map, fetch_obs_study_manual part/sessionFlow, and agent rules." />
  ${siteFonts()}
  <style>${siteCss()}</style>
</head>
<body>
  ${siteHeader(base, "docs")}
  <main class="docs">
    <header class="guide-hero">
      <div class="guide-hero-inner">
        <p class="section-kicker">MCP developer guide</p>
        <h2>Connect agents to OBS-TF MCP</h2>
        <span class="guide-rule" aria-hidden="true"></span>
        <p class="lead">
          How to register this Model Context Protocol server, call its tools, and pace
          Open Bible Stories + Theological Formation (Five Movements) content correctly.
        </p>
        <div class="guide-intro-body">
          <p>
            <strong>OBS-TF MCP</strong> is a tool server — not a chat product. Clients
            (Claude, Cursor, BT Servant coaches, custom agents) invoke named tools over
            <a href="${base}/mcp"><code>${base}/mcp</code></a> and receive structured study-manual data.
          </p>
          <p>
            Sibling in the
            <a href="https://www.btservant.ai/" target="_blank" rel="noopener">BT Servant</a>
            ecosystem:
            <a href="https://tc-helps.mcp.servant.bible/v2/" target="_blank" rel="noopener">Translation Helps MCP</a>
            covers scripture helps (TN / TW / TA / TQ / passage). This server covers
            <strong>OBS Theological Formation</strong> manuals only.
          </p>
        </div>
      </div>
    </header>

    <section class="guide-section reveal" aria-labelledby="connect-heading">
      <div class="guide-section-head">
        ${guideIcon("source")}
        <div>
          <p class="section-kicker">Setup</p>
          <h2 id="connect-heading">Connect</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      ${renderMcpConnectSetup(base)}
      <ul class="connect-list" style="margin-top:1.25rem">
        <li><span class="label">MCP</span><a href="${base}/mcp">${base}/mcp</a></li>
        <li><span class="label">Manifest</span><a href="${base}/api/mcp-manifest">${base}/api/mcp-manifest</a></li>
        <li><span class="label">Tool API</span><code>POST ${base}/api/tool</code></li>
        <li><span class="label">Health</span><a href="${base}/health">${base}/health</a></li>
      </ul>
    </section>

    <section class="guide-section is-alt reveal" aria-labelledby="domain-heading">
      <div class="guide-section-head">
        ${guideIcon("pace")}
        <div>
          <p class="section-kicker">Content domain</p>
          <h2 id="domain-heading">What the tools return</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        Fifty Open Bible Stories (Creation → New Creation). Each story’s manual walks
        observe → discuss → draft → check → serve → share (Five Movements + session parts).
      </p>
      <div class="guide-benefits">
        <div class="guide-benefit reveal reveal-delay-1">
          ${guideIcon("source")}
          <div>
            <strong>Trusted source text</strong>
            <p>
              English from Door43 <code>en_obs_tf</code>
              (<code>subject=OBS Theological Formation</code>, <code>topic=tc-ready</code>).
              Indonesian from converted/local markdown until DCS-published.
            </p>
          </div>
        </div>
        <div class="guide-benefit reveal reveal-delay-2">
          ${guideIcon("pdf")}
          <div>
            <strong>Packaging resolved</strong>
            <p>
              Shared <code>![[transclusion]]</code> templates and story-unique text look the same
              in tool output — clients never open TX files by hand.
            </p>
          </div>
        </div>
        <div class="guide-benefit reveal reveal-delay-3">
          ${guideIcon("languages")}
          <div>
            <strong>Languages</strong>
            <p>
              Default <code>en</code>. Use <code>language=id</code> for Indonesian.
              Missing packs return <code>available: false</code> / <code>RESOURCE_NOT_AVAILABLE</code>
              (not a tool failure).
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="guide-section reveal" aria-labelledby="tools-heading">
      <div class="guide-section-head">
        ${guideIcon("tools")}
        <div>
          <p class="section-kicker">Reference</p>
          <h2 id="tools-heading">Tool map</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        Prefer the default during sessions. Helpers fill gaps; they should not replace paced fetches.
      </p>
      <table>
        <thead>
          <tr><th>Tool</th><th>When to use</th></tr>
        </thead>
        <tbody>
          <tr><td><code>list_languages</code></td><td>Languages with OBS-TF content</td></tr>
          <tr><td><code>list_resources</code></td><td>Availability summary for a language</td></tr>
          <tr><td><code>list_collections</code></td><td>Eleven units (Creation → New Creation)</td></tr>
          <tr><td><code>list_stories</code></td><td>Stories 1–50 (optionally by collection)</td></tr>
          <tr><td><code>get_framework</code></td><td>Five Movements definitions + <code>sessionFlow</code> overview</td></tr>
          <tr><td><code>fetch_obs_study_manual</code></td><td><strong>Default.</strong> Story:frame study content + <code>part</code> filter</td></tr>
          <tr><td><code>get_story</code></td><td>Intro + frames only</td></tr>
          <tr><td><code>get_devotional</code></td><td>Community Study only</td></tr>
          <tr><td><code>get_movement</code></td><td>One movement blob (may include drafting/checking fields)</td></tr>
          <tr><td><code>get_study_guide</code></td><td>Full session dump; prefer paced <code>fetch_obs_study_manual</code></td></tr>
          <tr><td><code>search_content</code></td><td>Find stories by keyword</td></tr>
          <tr><td><code>get_pdf</code></td><td>Indonesian PDF URL only — not for study Q&amp;A</td></tr>
        </tbody>
      </table>
    </section>

    <section class="guide-section is-alt reveal" aria-labelledby="loop-heading">
      <div class="guide-section-head">
        ${guideIcon("loop")}
        <div>
          <p class="section-kicker">Workflow</p>
          <h2 id="loop-heading">Recommended tool loop</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        Discover → choose story → load the map → fetch one <code>part</code> at a time.
      </p>
      <ol class="steps">
        <li>
          <strong>Discover</strong>
          <code>list_languages</code> / <code>list_resources</code> — confirm OBS-TF for the language.
        </li>
        <li>
          <strong>Choose the story</strong>
          <code>list_collections</code> / <code>list_stories</code> — pick story 1–50.
        </li>
        <li>
          <strong>Load the map</strong>
          <code>get_framework</code> — movement definitions and <code>sessionFlow</code>.
        </li>
        <li>
          <strong>Fetch one slice</strong>
          <code>fetch_obs_study_manual</code> with <code>part=…</code> — present exact questions, then advance.
        </li>
        <li>
          <strong>Helpers as needed</strong>
          <code>get_story</code>, <code>get_devotional</code>, <code>get_movement</code>, <code>search_content</code>.
        </li>
        <li>
          <strong>PDF last</strong>
          <code>get_pdf</code> — only when the client needs the Indonesian file URL.
        </li>
      </ol>

      <div class="callout reveal">
        <strong>Default tool.</strong>
        <p>
          Prefer <code>fetch_obs_study_manual</code> with a specific <code>part</code> during live sessions.
          Use <code>part: "full"</code> sparingly — overview, not facilitation.
        </p>
      </div>
    </section>

    <section class="guide-section reveal" aria-labelledby="manual-heading">
      <div class="guide-section-head">
        ${guideIcon("pace")}
        <div>
          <p class="section-kicker">Primary tool</p>
          <h2 id="manual-heading"><code>fetch_obs_study_manual</code></h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        Preferred surface for BT Servant and agent sessions
        (<a href="https://github.com/unfoldingWord/translation-helps-mcp/issues/36" target="_blank" rel="noopener">(#36)</a>.
      </p>
      <table>
        <thead>
          <tr><th>Param</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>reference</code></td><td>OBS <code>story:frame</code> — <code>"1:1"</code>, <code>"1"</code> (whole story), <code>"1:0"</code> (intro). Optional <code>obs </code> prefix.</td></tr>
          <tr><td><code>language</code></td><td>Default <code>en</code>. Use <code>id</code> for Indonesian.</td></tr>
          <tr><td><code>part</code></td><td><code>intro</code> \| <code>frames</code> \| <code>community</code> \| <code>movement1</code>–<code>5</code> \| <code>drafting</code> \| <code>checking</code> \| <code>conclusion</code> \| <code>full</code></td></tr>
          <tr><td><code>movement</code></td><td>Optional <code>1</code>–<code>5</code> (same as <code>part=movementN</code>). Prefer <code>part</code> for drafting/checking/conclusion.</td></tr>
          <tr><td><code>format</code></td><td><code>json</code> (default), <code>md</code>, or <code>text</code> — md/text render from the same parsed data.</td></tr>
        </tbody>
      </table>
      <p>
        Response includes <code>sections</code>, <code>sessionFlow</code>, and (when present)
        <code>drafting</code>, <code>checking</code>, <code>conclusion</code>.
      </p>

      <h3>Session flow (pace with <code>part</code>)</h3>
      ${sessionFlowSvg()}

      <table>
        <thead>
          <tr><th>part</th><th>Content returned</th><th>Typical activity</th></tr>
        </thead>
        <tbody>
          <tr><td><code>intro</code></td><td>Key idea, creedal verse, metanarrative</td><td>Orient</td></tr>
          <tr><td><code>frames</code></td><td>Story panel text (optionally one frame via <code>1:3</code>)</td><td>Read / retell</td></tr>
          <tr><td><code>community</code></td><td>Community Study / devotion</td><td>Formation practice</td></tr>
          <tr><td><code>movement1</code></td><td>Observation + translation-term Q&amp;A</td><td>Observe; discuss terms</td></tr>
          <tr><td><code>movement2</code></td><td>Discourse + theological questions</td><td>Discuss meaning</td></tr>
          <tr><td><code>drafting</code></td><td>Translation draft instructions</td><td>Draft panels</td></tr>
          <tr><td><code>movement3</code></td><td>Journal reflection</td><td>Personal response</td></tr>
          <tr><td><code>checking</code></td><td>Team quality-check questions</td><td>Clear / accurate / natural</td></tr>
          <tr><td><code>movement4</code></td><td>Ministry practice framework</td><td>Serve with the story</td></tr>
          <tr><td><code>movement5</code></td><td>Missional outreach framework</td><td>Share beyond the church</td></tr>
          <tr><td><code>conclusion</code></td><td>Closing wrap-up</td><td>Hand off revised draft</td></tr>
        </tbody>
      </table>
      <p class="muted" style="font-size:0.92rem">
        Typical order from <code>sessionFlow</code>: intro → frames → community → movement1 → movement2 →
        drafting → movement3 → checking → movement4 → movement5 → conclusion.
      </p>
    </section>

    <section class="guide-section is-alt reveal" aria-labelledby="examples-heading">
      <div class="guide-section-head">
        ${guideIcon("source")}
        <div>
          <p class="section-kicker">Examples</p>
          <h2 id="examples-heading">Example tool calls</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p>Checking questions for Indonesian story&nbsp;1:</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1",
    "language": "id",
    "part": "checking",
    "format": "md"
  }
}</pre>
      <p>Frame-scoped observation (story 1, frame 3):</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1:3",
    "language": "en",
    "part": "movement1",
    "format": "json"
  }
}</pre>
      <p>Whole-story overview (use sparingly in live facilitation):</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "7",
    "language": "en",
    "part": "full",
    "format": "json"
  }
}</pre>

      <h3>Direct HTTP invoke</h3>
<pre>POST ${base}/api/tool
Content-Type: application/json

{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1:1",
    "language": "en",
    "part": "intro",
    "format": "md"
  }
}</pre>
      <p>Add <code>"debug": true</code> for X-ray pipeline traces (also available on <a href="${base}/debug">/debug</a>).</p>
    </section>

    <section class="guide-section reveal" aria-labelledby="patterns-heading">
      <div class="guide-section-head">
        ${guideIcon("chat")}
        <div>
          <p class="section-kicker">Patterns</p>
          <h2 id="patterns-heading">Agent behavior patterns</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        Tool call first → present exact manual text → offer to advance when the team is ready.
      </p>

      <div class="card reveal reveal-delay-1">
        <h3>Pattern: One frame, one movement</h3>
        <div class="beat">
          <div class="beat-who user">Request</div>
          <div class="beat-body">
            <p>“Observation questions for Indonesian OBS story 2, frame 1 only.”</p>
          </div>
        </div>
        <div class="beat">
          <div class="beat-who">Agent</div>
          <div class="beat-body">
            <p>
              Calls <code>fetch_obs_study_manual</code> with
              <code>reference: "2:1"</code>, <code>language: "id"</code>, <code>part: "movement1"</code>.
              Facilitates returned observation Q&amp;A; does not invent replacements.
            </p>
          </div>
        </div>
      </div>

      <div class="card reveal reveal-delay-2">
        <h3>Pattern: Drafting from the manual</h3>
        <div class="beat">
          <div class="beat-who user">Request</div>
          <div class="beat-body">
            <p>“We finished discussing meaning. Help us draft.”</p>
          </div>
        </div>
        <div class="beat">
          <div class="beat-who">Agent</div>
          <div class="beat-body">
            <p>
              Calls <code>part: "drafting"</code> — not a free-form drafting prompt.
              Walks steps from the tool output, then suggests <code>part: "checking"</code>.
            </p>
          </div>
        </div>
      </div>

      <div class="card reveal reveal-delay-3">
        <h3>Pattern: Missing content</h3>
        <div class="beat">
          <div class="beat-who user">Request</div>
          <div class="beat-body">
            <p>“Open checking for a language with no OBS-TF pack.”</p>
          </div>
        </div>
        <div class="beat">
          <div class="beat-who">Agent</div>
          <div class="beat-body">
            <p>
              Treats <code>available: false</code> / <code>RESOURCE_NOT_AVAILABLE</code> as the answer —
              report what is missing; do not invent checking questions.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="guide-section is-alt reveal" aria-labelledby="rules-heading">
      <div class="guide-section-head">
        ${guideIcon("rules")}
        <div>
          <p class="section-kicker">Guardrails</p>
          <h2 id="rules-heading">Agent rules</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <div class="callout warn">
        <strong>Do not invent theology or checking criteria.</strong>
        <p>
          Use exact questions from the tools. Classic OBS translation notes / word links belong on
          <a href="https://tc-helps.mcp.servant.bible/v2/" target="_blank" rel="noopener">Translation Helps MCP</a>, not here.
        </p>
      </div>
      <ul>
        <li>Prefer <code>part</code> over <code>full</code> during a live session.</li>
        <li>Treat <code>available: false</code> / <code>RESOURCE_NOT_AVAILABLE</code> as a clear answer.</li>
        <li>Default language is <code>en</code>; use <code>id</code> when requested.</li>
        <li>md/text are rendered from the same parsed JSON (never falsely empty when data exists).</li>
        <li>Responses may include <code>_meta.downstream_api_calls</code> and <code>_meta.cache_status</code> for clients that track them.</li>
      </ul>
    </section>

    <section class="guide-section reveal" aria-labelledby="try-heading">
      <div class="guide-section-head">
        ${guideIcon("chat")}
        <div>
          <p class="section-kicker">Optional</p>
          <h2 id="try-heading">Demo clients</h2>
        </div>
      </div>
      <span class="guide-rule" aria-hidden="true"></span>
      <p class="section-support" style="margin-top:0">
        These UIs call the same tools as any MCP client. They are not the product.
      </p>
      <div class="guide-cta-row">
        <a class="cta secondary" href="${base}/chat">Chat demo</a>
        <a class="cta secondary" href="${base}/debug">X-ray tool runner</a>
        <a class="cta" href="${base}/api/mcp-manifest">Tool manifest</a>
      </div>
    </section>

    ${siteFooter({
      extraMeta: `MCP endpoint: <a href="${base}/mcp"><code>${base}/mcp</code></a> · Content license: CC BY-SA 4.0 (unfoldingWord / partners)`,
    })}
  </main>
  ${guidePageScript()}
</body>
</html>`;
}
