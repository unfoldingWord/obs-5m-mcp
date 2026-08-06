/** Minimal X-ray debug UI (no SvelteKit) — call tools with debug:true and show traces. */

export function renderDebugPage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>obs-5m-mcp X-ray</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 1rem 1.25rem 3rem; max-width: 1100px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .sub { opacity: 0.7; font-size: 0.9rem; margin-bottom: 1rem; }
    label { display: block; font-size: 0.8rem; opacity: 0.8; margin-top: 0.6rem; }
    input, select, textarea, button {
      font: inherit; width: 100%; box-sizing: border-box; margin-top: 0.25rem;
      padding: 0.45rem 0.55rem; border-radius: 6px; border: 1px solid #8884;
      background: transparent;
    }
    textarea { min-height: 5rem; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    button {
      width: auto; margin-top: 0.85rem; cursor: pointer;
      background: #0b6bcb; color: #fff; border: none; padding: 0.5rem 1rem;
    }
    button.secondary { background: #555; margin-left: 0.5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 700px) { .row { grid-template-columns: 1fr; } }
    pre {
      white-space: pre-wrap; word-break: break-word;
      background: #0001; border-radius: 8px; padding: 0.75rem; font-size: 0.8rem;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .panel { border: 1px solid #8884; border-radius: 10px; padding: 0.75rem; }
    .panel h2 { font-size: 0.95rem; margin: 0 0 0.5rem; }
  </style>
</head>
<body>
  <h1>obs-5m-mcp X-ray</h1>
  <p class="sub">Pipeline transparency for tool calls. Base: ${base}
    · <a href="${base}/docs">Agent guide</a>
    · <a href="${base}/chat">Chat</a>
    · <a href="${base}/">Home</a>
  </p>

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
