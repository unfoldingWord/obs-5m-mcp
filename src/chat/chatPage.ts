/**
 * OBS Five Movements chat UI — same interaction pattern as Translation Helps
 * /chat (dock, chips, model/lang pickers, X-ray), wired to obs-5m tools.
 */

import { siteCss } from "../docs/siteStyles.js";

export function renderChatPage(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ezer · OBS Five Movements</title>
  <style>
    ${siteCss()}
    :root {
      --bg: #020617;
      --panel: #0f172a;
      --border: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #0ea5e9;
      --accent-soft: #0c4a6e;
      --user: #1e3a5f;
      --assistant: #0f172a;
      --status: #fbbf24;
      --chip: #1e293b;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc; --panel: #fff; --border: #e2e8f0; --text: #0f172a;
        --muted: #64748b; --accent-soft: #e0f2fe; --user: #e0f2fe;
        --assistant: #f1f5f9; --chip: #f1f5f9;
      }
    }
    body { display: flex; flex-direction: column; background: var(--bg); }
    header {
      position: sticky; top: 0; z-index: 3;
      padding: 0.65rem 1rem; border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      backdrop-filter: blur(10px);
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
    }
    header h1 { font-size: 1rem; margin: 0; font-weight: 650; }
    header .sub { color: var(--muted); font-size: 0.8rem; }
    header a { color: var(--accent); font-size: 0.8rem; }
    header .spacer { flex: 1; }
    #messages {
      flex: 1; overflow-y: auto; padding: 1rem 1rem 0.5rem;
      display: flex; flex-direction: column; gap: 0.75rem;
      max-width: 880px; width: 100%; margin: 0 auto;
    }
    .msg {
      padding: 0.8rem 0.95rem; border-radius: 14px; max-width: 92%;
      line-height: 1.5; font-size: 0.95rem;
    }
    .msg.user {
      align-self: flex-end; background: var(--user);
      white-space: pre-wrap;
    }
    .msg.assistant {
      align-self: flex-start; background: var(--assistant);
      border: 1px solid var(--border);
    }
    .msg.assistant .md h1,.msg.assistant .md h2,.msg.assistant .md h3 {
      margin: 0.7rem 0 0.35rem; font-size: 1rem;
    }
    .msg.assistant .md p { margin: 0.35rem 0; }
    .msg.assistant .md ul, .msg.assistant .md ol { margin: 0.35rem 0 0.35rem 1.1rem; }
    .msg.assistant .md code {
      font-family: ui-monospace, monospace; font-size: 0.85em;
      background: #0002; padding: 0.1em 0.3em; border-radius: 4px;
    }
    .msg.assistant .md pre {
      background: #0003; border: 1px solid var(--border); border-radius: 8px;
      padding: 0.6rem 0.75rem; overflow-x: auto; font-size: 0.82rem;
    }
    .msg.status {
      align-self: center; color: var(--status); font-size: 0.8rem;
      background: transparent; padding: 0.2rem; border: none;
    }
    .tools {
      font-size: 0.72rem; color: var(--muted); margin-top: 0.5rem;
      border-top: 1px solid var(--border); padding-top: 0.4rem;
    }
    #dock {
      border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 95%, transparent);
      backdrop-filter: blur(12px);
      padding: 0.55rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
    }
    #dock-inner { max-width: 880px; margin: 0 auto; }
    .row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.45rem; }
    .modes {
      display: inline-flex; border: 1px solid var(--border); border-radius: 8px;
      background: var(--chip); padding: 2px;
    }
    .modes button {
      border: none; background: transparent; color: var(--muted);
      font: inherit; font-size: 0.7rem; font-weight: 600; padding: 0.35rem 0.55rem;
      border-radius: 6px; cursor: pointer;
    }
    .modes button.active { background: var(--accent); color: #fff; }
    .chip-btn {
      border: 1px solid var(--border); background: var(--chip); color: var(--text);
      font: inherit; font-size: 0.72rem; padding: 0.3rem 0.65rem; border-radius: 999px;
      cursor: pointer;
    }
    .chip-btn:hover { border-color: var(--accent); }
    .chip-btn.active { border-color: var(--accent); background: var(--accent-soft); }
    .chip-btn.mono { font-family: ui-monospace, monospace; letter-spacing: 0.02em; }
    .ml-auto { margin-left: auto; }
    .chips {
      display: flex; gap: 0.35rem; overflow-x: auto; padding-bottom: 0.4rem;
      scrollbar-width: thin;
    }
    .chips button {
      flex: 0 0 auto; border: 1px solid var(--border); background: transparent;
      color: var(--muted); font: inherit; font-size: 0.72rem; padding: 0.3rem 0.65rem;
      border-radius: 999px; cursor: pointer;
    }
    .chips button:hover { color: var(--text); border-color: var(--accent); }
    #composer form { display: flex; gap: 0.45rem; align-items: flex-end; }
    #composer textarea {
      flex: 1; min-height: 2.7rem; max-height: 8rem; resize: vertical;
      font: inherit; border-radius: 10px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); padding: 0.55rem 0.7rem;
    }
    #composer button.send {
      background: var(--accent); color: #fff; border: none; border-radius: 10px;
      padding: 0.65rem 1rem; cursor: pointer; font-weight: 600;
    }
    #composer button.send:disabled { opacity: 0.5; cursor: wait; }
    #xray {
      display: none; border-top: 1px solid var(--border); background: var(--panel);
      max-height: 240px; overflow: auto; padding: 0.75rem 1rem;
      font-family: ui-monospace, monospace; font-size: 0.72rem;
      white-space: pre-wrap; color: var(--muted);
    }
    #xray.open { display: block; }
    .popover {
      position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 20;
      width: 14rem; max-height: 16rem; overflow: auto;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 12px 40px #0006; padding: 0.35rem;
    }
    .popover button {
      display: block; width: 100%; text-align: left; border: none; background: transparent;
      color: var(--text); font: inherit; font-size: 0.8rem; padding: 0.45rem 0.55rem;
      border-radius: 8px; cursor: pointer;
    }
    .popover button:hover, .popover button.sel { background: var(--accent-soft); }
    .rel { position: relative; }
    .scope {
      font-size: 0.72rem; color: #c4b5fd; border: 1px solid #6d28d9aa;
      background: #2e106555; border-radius: 999px; padding: 0.25rem 0.6rem;
      max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Ezer · OBS Five Movements</h1>
      <div class="sub">Same chat pattern as Translation Helps · tools from this MCP</div>
    </div>
    <div class="spacer"></div>
    <a href="${base}/docs">Agent guide</a>
    <a href="${base}/debug">X-ray tools</a>
    <a href="${base}/">Home</a>
  </header>

  <div id="messages"></div>
  <pre id="xray"></pre>

  <div id="dock">
    <div id="dock-inner">
      <div class="row">
        <div class="modes" id="modes" title="Session focus (shapes quick chips)"></div>
        <span class="scope" id="scopeChip">Story — · lang —</span>
        <div class="ml-auto rel">
          <button type="button" class="chip-btn mono" id="langBtn">EN</button>
          <div class="popover" id="langPop" hidden></div>
        </div>
        <div class="rel">
          <button type="button" class="chip-btn mono" id="storyBtn">Story 1</button>
          <div class="popover" id="storyPop" hidden></div>
        </div>
        <div class="rel">
          <button type="button" class="chip-btn mono" id="modelBtn">gpt-4.1</button>
          <div class="popover" id="modelPop" hidden></div>
        </div>
        <button type="button" class="chip-btn" id="xrayToggle">X-ray</button>
        <button type="button" class="chip-btn" id="clearBtn" title="Clear chat">Clear</button>
      </div>
      <div class="chips" id="quickChips"></div>
      <div id="composer">
        <form id="form">
          <textarea id="input" rows="2" placeholder="Lead a Five Movements session… e.g. “Open observation questions for this story”"></textarea>
          <button class="send" type="submit" id="send">Send</button>
        </form>
      </div>
    </div>
  </div>

  <script>
    const base = ${JSON.stringify(base)};
    const MODELS = [
      { id: 'study', label: 'Study' },
      { id: 'draft', label: 'Draft' },
      { id: 'check', label: 'Check' },
      { id: 'serve', label: 'Serve' },
    ];
    const MODELS_CHIPS = {
      study: [
        { label: 'Intro', prompt: 'Show the introduction (key idea, creedal verse, metanarrative) for the current story.' },
        { label: 'Frames', prompt: 'Show the story frames for the current story so we can read them together.' },
        { label: 'Community', prompt: 'Open the Community Study for the current story and facilitate it.' },
        { label: 'Observe', prompt: 'Lead movement 1 (observation + translation terms) for the current story. Use part=movement1.' },
        { label: 'Discuss', prompt: 'Lead movement 2 (discourse + theological questions). Use part=movement2.' },
      ],
      draft: [
        { label: 'Draft', prompt: 'Open the translation drafting activity (part=drafting) and walk the team through it.' },
        { label: 'Journal', prompt: 'Open journal reflection (part=movement3) for the current story.' },
      ],
      check: [
        { label: 'Team check', prompt: 'Open the team checking questions (part=checking) and facilitate a quality check.' },
        { label: 'Conclusion', prompt: 'Open the conclusion wrap-up (part=conclusion).' },
      ],
      serve: [
        { label: 'Ministry', prompt: 'Open ministry practice (part=movement4) and help plan serving with this story.' },
        { label: 'Mission', prompt: 'Open missional outreach (part=movement5) and help plan sharing beyond the church.' },
      ],
    };
    const LANGS = [
      { code: 'en', name: 'English' },
      { code: 'id', name: 'Indonesian' },
    ];
    const MODELS_OPTS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
    const STORIES = Array.from({ length: 50 }, (_, i) => i + 1);

    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const xrayEl = document.getElementById('xray');
    const scopeChip = document.getElementById('scopeChip');
    const modesEl = document.getElementById('modes');
    const quickEl = document.getElementById('quickChips');
    const langBtn = document.getElementById('langBtn');
    const storyBtn = document.getElementById('storyBtn');
    const modelBtn = document.getElementById('modelBtn');
    const langPop = document.getElementById('langPop');
    const storyPop = document.getElementById('storyPop');
    const modelPop = document.getElementById('modelPop');
    const xrayToggle = document.getElementById('xrayToggle');

    let mode = localStorage.getItem('obs_chat_mode') || 'study';
    let language = localStorage.getItem('obs_chat_lang') || 'en';
    let story = Number(localStorage.getItem('obs_chat_story') || '1');
    let model = localStorage.getItem('obs_chat_model') || 'gpt-4.1';
    let xrayOn = localStorage.getItem('obs_chat_xray') === '1';
    /** @type {{role:string, content:string}[]} */
    let history = [];
    let busy = false;

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function simpleMd(text) {
      let t = esc(text);
      t = t.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, (_, c) => '<pre><code>' + c + '</code></pre>');
      t = t.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      t = t.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      t = t.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      t = t.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
      t = t.replace(/(<li>.*<\\/li>\\n?)+/g, (m) => '<ul>' + m + '</ul>');
      t = t.replace(/^(?!<[hul]|<pre|<li)(.+)$/gm, '<p>$1</p>');
      return t;
    }

    function syncScope() {
      scopeChip.textContent = 'Story ' + story + ' · ' + language.toUpperCase();
      langBtn.textContent = language.toUpperCase();
      storyBtn.textContent = 'Story ' + story;
      modelBtn.textContent = model;
      xrayToggle.classList.toggle('active', xrayOn);
      localStorage.setItem('obs_chat_mode', mode);
      localStorage.setItem('obs_chat_lang', language);
      localStorage.setItem('obs_chat_story', String(story));
      localStorage.setItem('obs_chat_model', model);
      localStorage.setItem('obs_chat_xray', xrayOn ? '1' : '0');
    }

    function renderModes() {
      modesEl.innerHTML = '';
      for (const m of MODELS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = m.label;
        b.className = m.id === mode ? 'active' : '';
        b.onclick = () => { mode = m.id; renderModes(); renderChips(); syncScope(); };
        modesEl.appendChild(b);
      }
    }

    function renderChips() {
      quickEl.innerHTML = '';
      for (const chip of (MODELS_CHIPS[mode] || [])) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = chip.label;
        b.onclick = () => sendPrompt(chip.prompt);
        quickEl.appendChild(b);
      }
    }

    function fillPop(el, items, current, onPick) {
      el.innerHTML = '';
      for (const item of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = item.label;
        if (item.value === current) b.className = 'sel';
        b.onclick = () => { onPick(item.value); el.hidden = true; };
        el.appendChild(b);
      }
    }

    function closePops() {
      langPop.hidden = true;
      storyPop.hidden = true;
      modelPop.hidden = true;
    }

    langBtn.onclick = (e) => {
      e.stopPropagation();
      const open = langPop.hidden;
      closePops();
      if (open) {
        fillPop(langPop, LANGS.map(l => ({ value: l.code, label: l.code.toUpperCase() + ' — ' + l.name })), language, (v) => {
          language = v; syncScope();
        });
        langPop.hidden = false;
      }
    };
    storyBtn.onclick = (e) => {
      e.stopPropagation();
      const open = storyPop.hidden;
      closePops();
      if (open) {
        fillPop(storyPop, STORIES.map(n => ({ value: n, label: 'Story ' + n })), story, (v) => {
          story = v; syncScope();
        });
        storyPop.hidden = false;
      }
    };
    modelBtn.onclick = (e) => {
      e.stopPropagation();
      const open = modelPop.hidden;
      closePops();
      if (open) {
        fillPop(modelPop, MODELS_OPTS.map(m => ({ value: m, label: m })), model, (v) => {
          model = v; syncScope();
        });
        modelPop.hidden = false;
      }
    };
    document.addEventListener('click', closePops);
    xrayToggle.onclick = () => {
      xrayOn = !xrayOn;
      if (!xrayOn) xrayEl.classList.remove('open');
      syncScope();
    };
    document.getElementById('clearBtn').onclick = () => {
      history = [];
      messagesEl.innerHTML = '';
      xrayEl.classList.remove('open');
      greet();
    };

    function addBubble(role, content, asMd) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      if (role === 'assistant' && asMd) {
        const wrap = document.createElement('div');
        wrap.className = 'md';
        wrap.innerHTML = simpleMd(content);
        div.appendChild(wrap);
      } else {
        div.textContent = content;
      }
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function setStatus(text) {
      let el = messagesEl.querySelector('.msg.status');
      if (!el) {
        el = document.createElement('div');
        el.className = 'msg status';
        messagesEl.appendChild(el);
      }
      el.textContent = text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function clearStatus() {
      messagesEl.querySelector('.msg.status')?.remove();
    }

    async function sendPrompt(text) {
      if (busy || !text.trim()) return;
      inputEl.value = '';
      const userText = text.trim();
      history.push({ role: 'user', content: userText });
      addBubble('user', userText, false);
      busy = true;
      sendBtn.disabled = true;
      const assistantEl = addBubble('assistant', '', true);
      const md = assistantEl.querySelector('.md');
      let assembled = '';
      setStatus('Connecting…');
      try {
        const res = await fetch(base + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            model,
            debug: xrayOn,
            language,
            story,
            mode,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || ('HTTP ' + res.status));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\\n\\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const lines = part.split('\\n');
            let event = 'message';
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;
            let data;
            try { data = JSON.parse(dataLine); } catch { continue; }
            if (event === 'status') setStatus(data.text || '');
            if (event === 'token') {
              clearStatus();
              assembled += data.text || '';
              md.innerHTML = simpleMd(assembled);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            if (event === 'error') {
              clearStatus();
              md.textContent = 'Error: ' + (data.message || 'unknown');
            }
            if (event === 'done') {
              clearStatus();
              if (data.response) {
                assembled = data.response;
                md.innerHTML = simpleMd(assembled);
              }
              if (data.toolCalls?.length) {
                const tip = document.createElement('div');
                tip.className = 'tools';
                tip.textContent = 'Tools: ' + data.toolCalls.map(t => t.name + (t.ok ? '' : '✗')).join(', ');
                assistantEl.appendChild(tip);
              }
              if (data.xrayReport) {
                xrayEl.textContent = data.xrayReport;
                xrayEl.classList.add('open');
              }
            }
          }
        }
        if (assembled) history.push({ role: 'assistant', content: assembled });
      } catch (err) {
        clearStatus();
        md.textContent = 'Error: ' + (err.message || String(err));
      } finally {
        busy = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    document.getElementById('form').onsubmit = (e) => {
      e.preventDefault();
      sendPrompt(inputEl.value);
    };

    function greet() {
      addBubble(
        'assistant',
        'Hi — I am **Ezer** (helper). I coach OBS Five Movements: observe → discuss → reflect → serve → share (plus draft/check).\\n\\n' +
        'Which story (1–50, or by title) would you like to start studying?',
        true,
      );
    }

    renderModes();
    renderChips();
    syncScope();
    greet();
  </script>
</body>
</html>`;
}
