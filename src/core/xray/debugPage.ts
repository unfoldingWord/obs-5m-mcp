/** Minimal X-ray debug UI (no SvelteKit) — call tools with debug:true and show traces. */

import { siteCss, siteFonts, siteFooter, siteHeader } from "../../docs/siteStyles.js";

export function renderDebugPage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>X-ray · OBS-TF MCP</title>
  <meta name="description" content="Debug client for OBS-TF MCP — run tools with pipeline traces." />
  ${siteFonts()}
  <style>
    ${siteCss()}
    .xray-wrap { max-width: 1100px; margin: 0 auto; padding: 1.5rem clamp(1rem, 3vw, 2rem) 3rem; }
    .xray-wrap h1 {
      font-family: var(--font-display); font-size: 1.65rem; margin: 0 0 0.35rem;
      letter-spacing: -0.02em;
    }
    .xray-wrap .sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 0.85rem; max-width: 40rem; }
    .xray-wrap label { display: block; font-size: 0.8rem; color: var(--muted); margin-top: 0.65rem; font-weight: 600; }
    .xray-wrap input, .xray-wrap select, .xray-wrap textarea {
      font: inherit; width: 100%; box-sizing: border-box; margin-top: 0.25rem;
      padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid var(--line);
      background: #fff; color: var(--ink);
    }
    .xray-wrap textarea { min-height: 5rem; font-family: var(--font-mono); font-size: 0.85rem; }
    .xray-wrap button {
      width: auto; margin-top: 0.85rem; cursor: pointer; font: inherit; font-weight: 600;
      background: var(--sage); color: #fff; border: none; padding: 0.55rem 1.1rem; border-radius: 6px;
    }
    .xray-wrap button.secondary {
      background: transparent; color: var(--ink); border: 1px solid var(--line); margin-left: 0.5rem;
    }
    .xray-wrap .row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 700px) { .xray-wrap .row { grid-template-columns: 1fr; } }
    .xray-wrap pre {
      white-space: pre-wrap; word-break: break-word;
      background: #e8eef1; border: 1px solid var(--line); border-radius: 6px;
      padding: 0.75rem; font-size: 0.8rem;
    }
    .xray-wrap .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
    @media (max-width: 900px) { .xray-wrap .grid { grid-template-columns: 1fr; } }
    .xray-wrap .panel {
      border: 1px solid var(--line); border-radius: 6px; padding: 0.85rem; background: #fff;
    }
    .xray-wrap .panel h2 {
      font-family: var(--font-display); font-size: 1rem; margin: 0 0 0.5rem;
    }
    .xray-orient {
      margin: 0 0 1.35rem;
      padding: 1rem 1.15rem;
      background: var(--sage-soft);
      border: 1px solid #c5d9ce;
      border-radius: var(--radius);
      max-width: 42rem;
    }
    .xray-orient p { margin: 0.35rem 0 0; color: var(--ink-soft); font-size: 0.95rem; }
    .xray-orient p:first-child { margin-top: 0; }
    .xray-orient strong { color: var(--sage-deep); }
  </style>
</head>
<body>
  ${siteHeader(base, "debug")}
  <div class="xray-wrap">
  <p class="section-kicker">MCP debug</p>
  <h1>X-ray</h1>
  <p class="sub">
    Debug client for this MCP server — invoke tools and inspect the resolution pipeline.
    Base: <code>${base}</code> · Production MCP: <a href="${base}/mcp"><code>/mcp</code></a>
  </p>

  <div class="xray-orient">
    <p><strong>How to use.</strong> Pick a tool, set language and reference, then run with X-ray.</p>
    <p>
      Start with <code>fetch_obs_study_manual</code> and a story like <code>1:1</code>.
      Result shows the payload; the report shows DCS / local resolution steps. Read-only — nothing here changes production data.
    </p>
  </div>

  <div class="row">
    <div>
      <label>Tool</label>
      <select id="tool"></select>
    </div>
    <div>
      <label>Language</label>
      <input id="language" value="en" />
    </div>
    <div>
      <label>Quick reference / story</label>
      <input id="reference" value="1:1" />
    </div>
  </div>
  <label>Arguments (JSON)</label>
  <textarea id="args">{\n  "reference": "1:1",\n  "language": "en",\n  "format": "json"\n}</textarea>
  <div>
    <button id="run">Run with X-ray</button>
    <button id="copy" class="secondary" type="button">Copy report</button>
  </div>

  <div class="grid">
    <div class="panel">
      <h2>Result</h2>
      <pre id="result">—</pre>
    </div>
    <div class="panel">
      <h2>X-ray report</h2>
      <pre id="xray">—</pre>
    </div>
  </div>
  </div>
  <div class="shell" style="padding-top:0">
    ${siteFooter({ extraMeta: "X-ray · tool runner for OBS-TF MCP" })}
  </div>

  <script>
    const base = ${JSON.stringify(base)};
    const toolEl = document.getElementById('tool');
    const argsEl = document.getElementById('args');
    const refEl = document.getElementById('reference');
    const langEl = document.getElementById('language');
    const resultEl = document.getElementById('result');
    const xrayEl = document.getElementById('xray');
    let lastReport = '';

    const presets = {
      fetch_obs_study_manual: () => ({
        reference: refEl.value || '1:1',
        language: langEl.value || 'en',
        format: 'json',
      }),
      get_study_guide: () => ({
        story: Number(String(refEl.value).split(':')[0] || 1),
        language: langEl.value || 'en',
      }),
      get_pdf: () => ({
        story: Number(String(refEl.value).split(':')[0] || 1),
        language: 'id',
      }),
      list_resources: () => ({ language: langEl.value || 'en' }),
      list_languages: () => ({}),
      get_framework: () => ({}),
    };

    function syncArgs() {
      const name = toolEl.value;
      const build = presets[name];
      if (build) argsEl.value = JSON.stringify(build(), null, 2);
    }

    async function loadTools() {
      const res = await fetch(base + '/api/mcp-manifest');
      const data = await res.json();
      for (const t of data.tools || []) {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        toolEl.appendChild(opt);
      }
      toolEl.value = 'fetch_obs_study_manual';
      syncArgs();
    }

    toolEl.addEventListener('change', syncArgs);
    refEl.addEventListener('change', syncArgs);
    langEl.addEventListener('change', syncArgs);

    document.getElementById('run').onclick = async () => {
      resultEl.textContent = 'Running…';
      xrayEl.textContent = '…';
      let args;
      try { args = JSON.parse(argsEl.value); }
      catch (e) { resultEl.textContent = 'Invalid JSON args: ' + e; return; }
      const res = await fetch(base + '/api/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolEl.value, arguments: args, debug: true }),
      });
      const data = await res.json();
      resultEl.textContent = JSON.stringify(data.result ?? data, null, 2);
      lastReport = data.xrayReport || JSON.stringify(data.xray || [], null, 2);
      xrayEl.textContent = lastReport;
    };

    document.getElementById('copy').onclick = async () => {
      await navigator.clipboard.writeText(lastReport || xrayEl.textContent);
    };

    loadTools().catch((e) => { resultEl.textContent = String(e); });
  </script>
</body>
</html>`;
}
