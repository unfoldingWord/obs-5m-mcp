/** Shared look for Worker-served HTML pages (chat / docs / home). */

export function siteCss(): string {
  return `
    :root {
      color-scheme: light dark;
      --bg: #0f1419;
      --panel: #1a222c;
      --border: #2c3845;
      --text: #e7eef5;
      --muted: #8aa0b5;
      --accent: #3d8bfd;
      --accent-soft: #1e3a5f;
      --good: #3dd68c;
      --warn: #c9a227;
      font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f4f7fb; --panel: #fff; --border: #d5dee8; --text: #15202b;
        --muted: #5b6b7c; --accent-soft: #e8f1ff;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
      line-height: 1.55;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    header {
      padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
      background: var(--panel); position: sticky; top: 0; z-index: 2;
    }
    header h1 { font-size: 1.05rem; margin: 0; font-weight: 650; }
    header .sub { color: var(--muted); font-size: 0.85rem; }
    header nav { display: flex; gap: 0.85rem; flex-wrap: wrap; margin-left: auto; font-size: 0.85rem; }
    main { max-width: 820px; margin: 0 auto; padding: 1.5rem 1.25rem 3.5rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 0.65rem; }
    h3 { font-size: 1.02rem; margin: 1.4rem 0 0.45rem; }
    p, li { color: var(--text); }
    .muted { color: var(--muted); }
    .lead { font-size: 1.05rem; color: var(--muted); margin-top: 0.35rem; }
    .card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 12px; padding: 1rem 1.1rem; margin: 1rem 0;
    }
    .card h3 { margin-top: 0; }
    .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1rem 0;
    }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    .flow {
      display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 1rem;
    }
    .chip {
      display: inline-block; padding: 0.25rem 0.55rem; border-radius: 999px;
      background: var(--accent-soft); color: var(--text); font-size: 0.78rem;
      border: 1px solid var(--border);
    }
    .chip.arrow { background: transparent; border: none; color: var(--muted); padding: 0.25rem 0.1rem; }
    pre, code {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.82rem;
    }
    pre {
      background: #0002; border: 1px solid var(--border); border-radius: 10px;
      padding: 0.85rem 1rem; overflow-x: auto; white-space: pre-wrap;
    }
    table {
      width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0 1.25rem;
    }
    th, td {
      text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 600; font-size: 0.8rem; }
    .benefit { border-left: 3px solid var(--good); padding-left: 0.85rem; margin: 0.75rem 0; }
    footer {
      margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--border);
      color: var(--muted); font-size: 0.85rem;
    }
    .cta {
      display: inline-block; margin: 0.35rem 0.5rem 0.35rem 0; padding: 0.55rem 0.9rem;
      border-radius: 8px; background: var(--accent); color: #fff !important;
      text-decoration: none !important; font-size: 0.9rem; font-weight: 600;
    }
    .cta.secondary { background: transparent; color: var(--accent) !important; border: 1px solid var(--border); }
  `;
}

export function siteHeader(base: string, active: "home" | "docs" | "chat" | "debug"): string {
  const link = (href: string, label: string, key: typeof active) =>
    `<a href="${base}${href}"${key === active ? ' aria-current="page" style="font-weight:700"' : ""}>${label}</a>`;
  return `
  <header>
    <div>
      <h1>OBS Five Movements MCP</h1>
      <div class="sub">Open Bible Stories + Theological Formation for AI agents</div>
    </div>
    <nav>
      ${link("/", "Home", "home")}
      ${link("/docs", "Agent guide", "docs")}
      ${link("/chat", "Chat", "chat")}
      ${link("/debug", "X-ray", "debug")}
      <a href="${base}/api/mcp-manifest">Manifest</a>
    </nav>
  </header>`;
}
