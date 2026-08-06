/** Documentation: how AI agents use obs-5m-mcp tools for translator sessions. */

import { siteCss, siteHeader } from "./siteStyles.js";

export function renderAgentGuidePage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agent guide · Ezer · OBS Five Movements</title>
  <meta name="description" content="How AI agents use OBS Theological Formation MCP tools to lead translation study sessions." />
  <style>${siteCss()}</style>
</head>
<body>
  ${siteHeader(base, "docs")}
  <main>
    <h2 style="margin-top:0">How an AI agent uses these tools</h2>
    <p class="lead">
      Agents should speak as <strong>Ezer</strong> (Hebrew for “helper”) — the coach
      persona for this MCP, parallel to Translation Helps chat. Content is Open Bible
      Stories + Theological Formation (Five Movements) for locally-led formation:
      Scripture forms the church; it does not merely inform it. Fifty stories survey
      Creation to New Creation; each moves through observe → discuss → reflect → serve → share
      (with drafting/checking woven in). Fetch one session slice at a time,
      use the exact questions returned, and never invent replacements.
      Framing: <a href="https://formationstories.org/introduction/">Formation Stories</a>
      (CC BY-SA 4.0; unfoldingWord OBS).
    </p>

    <div class="card">
      <h3>Why this helps users</h3>
      <div class="benefit">
        <strong>Facilitated sessions without hunting PDFs.</strong>
        Translators ask in natural language; the agent pulls the right movement,
        drafting checklist, or checking questions for that story and language.
      </div>
      <div class="benefit">
        <strong>Same workflow in English and Indonesian.</strong>
        Packaging (shared templates vs story-unique text) is resolved for the agent.
        Users never need to open <code>![[transclusion]]</code> files.
      </div>
      <div class="benefit">
        <strong>Paced facilitation.</strong>
        Walking <code>sessionFlow</code> keeps the team on one activity
        (observe → draft → check → serve → share) instead of dumping the whole manual.
      </div>
      <div class="benefit">
        <strong>Trustworthy source text.</strong>
        Questions come from Door43 <code>en_obs_tf</code> or converted Indonesian OBS-TF markdown,
        not model memory.
      </div>
    </div>

    <h2>Recommended agent loop</h2>
    <ol>
      <li><code>list_languages</code> / <code>list_resources</code> — confirm the language has OBS-TF content.</li>
      <li><code>list_collections</code> / <code>list_stories</code> — pick story 1–50 (optionally by collection).</li>
      <li><code>get_framework</code> — load Five Movements definitions and <code>sessionFlow</code>.</li>
      <li><code>fetch_obs_study_manual</code> with <code>part=…</code> — load one slice, facilitate, then advance.</li>
      <li>Helpers only when needed: <code>get_story</code>, <code>get_devotional</code>, <code>get_movement</code>, <code>search_content</code>.</li>
      <li><code>get_pdf</code> — only if the user wants the Indonesian PDF download.</li>
    </ol>

    <h3>Session flow (pace with <code>part</code>)</h3>
    <div class="flow">
      <span class="chip">intro</span><span class="chip arrow">→</span>
      <span class="chip">frames</span><span class="chip arrow">→</span>
      <span class="chip">community</span><span class="chip arrow">→</span>
      <span class="chip">movement1</span><span class="chip arrow">→</span>
      <span class="chip">movement2</span><span class="chip arrow">→</span>
      <span class="chip">drafting</span><span class="chip arrow">→</span>
      <span class="chip">movement3</span><span class="chip arrow">→</span>
      <span class="chip">checking</span><span class="chip arrow">→</span>
      <span class="chip">movement4</span><span class="chip arrow">→</span>
      <span class="chip">movement5</span><span class="chip arrow">→</span>
      <span class="chip">conclusion</span>
    </div>

    <table>
      <thead>
        <tr><th>part</th><th>What the agent presents</th><th>User activity</th></tr>
      </thead>
      <tbody>
        <tr><td><code>intro</code></td><td>Key idea, creedal verse, metanarrative</td><td>Orient the team</td></tr>
        <tr><td><code>frames</code></td><td>Story panel text (optionally one frame via <code>1:3</code>)</td><td>Read / retell the story</td></tr>
        <tr><td><code>community</code></td><td>Community Study / devotion</td><td>Worship / formation practice</td></tr>
        <tr><td><code>movement1</code></td><td>Observation + translation-term Q&amp;A</td><td>Observe details; discuss terms</td></tr>
        <tr><td><code>movement2</code></td><td>Discourse + theological questions</td><td>Discuss meaning</td></tr>
        <tr><td><code>drafting</code></td><td>Translation draft instructions</td><td>Draft panels; note decisions</td></tr>
        <tr><td><code>movement3</code></td><td>Journal reflection</td><td>Personal response</td></tr>
        <tr><td><code>checking</code></td><td>Team quality-check questions</td><td>Check draft (clear / accurate / natural)</td></tr>
        <tr><td><code>movement4</code></td><td>Ministry practice framework</td><td>Serve the church with the story</td></tr>
        <tr><td><code>movement5</code></td><td>Missional outreach framework</td><td>Share beyond the church</td></tr>
        <tr><td><code>conclusion</code></td><td>Closing wrap-up</td><td>Celebrate; hand off revised draft</td></tr>
      </tbody>
    </table>

    <h2>Example tool calls</h2>
    <p class="muted">Primary tool for BT Servant / translation sessions:</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1",
    "language": "id",
    "part": "checking",
    "format": "md"
  }
}</pre>
    <p class="muted">Frame-scoped observation (story 1, frame 3):</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1:3",
    "language": "en",
    "part": "movement1",
    "format": "json"
  }
}</pre>
    <p class="muted">Whole story when the user wants an overview (use sparingly in live facilitation):</p>
<pre>{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "7",
    "language": "en",
    "part": "full",
    "format": "json"
  }
}</pre>

    <h2>What a good agent conversation looks like</h2>
    <div class="grid">
      <div class="card">
        <h3>User</h3>
        <p class="muted">“Lead movement 1 for Indonesian OBS story 2 — observation questions only for frame 1.”</p>
      </div>
      <div class="card">
        <h3>Agent</h3>
        <ol class="muted">
          <li>Calls <code>fetch_obs_study_manual</code> with <code>reference: "2:1"</code>, <code>language: "id"</code>, <code>part: "movement1"</code></li>
          <li>Reads the returned observation Q&amp;A</li>
          <li>Facilitates those questions with the team</li>
          <li>Offers to continue to translation terms or drafting when ready</li>
        </ol>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>User</h3>
        <p class="muted">“We finished discussing meaning. Help us draft the story.”</p>
      </div>
      <div class="card">
        <h3>Agent</h3>
        <p class="muted">Calls <code>part: "drafting"</code> (not a free-form drafting prompt), walks the draft / discuss / summary steps from the tool output, then suggests <code>part: "checking"</code>.</p>
      </div>
    </div>

    <h2>Tool map</h2>
    <table>
      <thead>
        <tr><th>Tool</th><th>When to use</th></tr>
      </thead>
      <tbody>
        <tr><td><code>fetch_obs_study_manual</code></td><td><strong>Default.</strong> Story:frame keyed study content + <code>part</code> filter</td></tr>
        <tr><td><code>get_framework</code></td><td>Explain the five movements / show sessionFlow</td></tr>
        <tr><td><code>list_stories</code> / <code>list_collections</code></td><td>Choose what to study next</td></tr>
        <tr><td><code>get_story</code></td><td>Intro + frames only</td></tr>
        <tr><td><code>get_devotional</code></td><td>Community Study only</td></tr>
        <tr><td><code>get_movement</code></td><td>One movement blob (includes drafting/checking fields when present)</td></tr>
        <tr><td><code>get_study_guide</code></td><td>Full session dump; prefer paced <code>fetch_obs_study_manual</code></td></tr>
        <tr><td><code>search_content</code></td><td>Find stories by keyword</td></tr>
        <tr><td><code>get_pdf</code></td><td>Indonesian PDF URL (not for study Q&amp;A)</td></tr>
      </tbody>
    </table>

    <h2>Agent rules of thumb</h2>
    <ul>
      <li>Prefer <code>part</code> over loading <code>full</code> during a live session.</li>
      <li>Use exact questions from the tool; do not paraphrase into different theology or checking criteria.</li>
      <li>Treat missing content as <code>available: false</code> / <code>RESOURCE_NOT_AVAILABLE</code> — tell the user clearly.</li>
      <li>Default language is <code>en</code>; use <code>id</code> when the user asks for Indonesian.</li>
      <li>Classic OBS translation notes / word links belong on Translation Helps MCP, not this server.</li>
    </ul>

    <h2>Try it</h2>
    <p>
      <a class="cta" href="${base}/chat">Open chat</a>
      <a class="cta secondary" href="${base}/debug">Run a tool (X-ray)</a>
      <a class="cta secondary" href="${base}/api/mcp-manifest">View tool manifest</a>
    </p>

    <footer>
      MCP endpoint: <a href="${base}/mcp"><code>${base}/mcp</code></a>
      · Content license: CC BY-SA 4.0 (unfoldingWord / partners)
    </footer>
  </main>
</body>
</html>`;
}
