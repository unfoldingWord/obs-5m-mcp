/** Shared look for Worker-served HTML pages (chat / docs / home). */

/** Google Fonts — Literata (brand/display) + Source Sans 3 (UI). */
export function siteFonts(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,500;0,7..72,650;0,7..72,700;1,7..72,500&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />`;
}

export function siteCss(): string {
  return `
    :root {
      color-scheme: light;
      --ink: #182028;
      --ink-soft: #2c3a45;
      --muted: #5c6b76;
      --line: #d3dce3;
      --paper: #f3f5f7;
      --panel: #ffffff;
      --sage: #2f5d4e;
      --sage-deep: #1e3f35;
      --sage-soft: #e4efe9;
      --sand: #c4a574;
      --bg: var(--paper);
      --text: var(--ink);
      --border: var(--line);
      --accent: var(--sage);
      --accent-soft: var(--sage-soft);
      --good: #2f5d4e;
      --warn: #9a7b3c;
      --font-display: "Literata", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      --font-body: "Source Sans 3", "Source Sans Pro", "Segoe UI", sans-serif;
      --font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Code", Consolas, monospace;
      --radius: 6px;
      --max: 68rem;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0; min-height: 100vh;
      background: var(--bg); color: var(--text);
      font-family: var(--font-body);
      font-size: 1.05rem;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--sage-deep); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
    a:hover { color: var(--sage); }
    code, pre { font-family: var(--font-mono); font-size: 0.86em; }
    code {
      background: var(--sage-soft); color: var(--sage-deep);
      padding: 0.12em 0.35em; border-radius: 4px;
    }
    pre {
      background: #e8eef1; border: 1px solid var(--line);
      border-radius: var(--radius); padding: 1rem 1.1rem;
      overflow-x: auto; white-space: pre-wrap; color: var(--ink-soft);
    }
    pre code { background: transparent; padding: 0; color: inherit; }

    /* —— Site chrome —— */
    .site-header {
      position: sticky; top: 0; z-index: 20;
      display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;
      padding: 0.85rem clamp(1rem, 3vw, 2rem);
      background: color-mix(in srgb, var(--paper) 88%, transparent);
      border-bottom: 1px solid transparent;
      backdrop-filter: blur(14px) saturate(1.1);
      transition: border-color 0.25s var(--ease);
    }
    .site-header.is-scrolled { border-bottom-color: var(--line); }
    .brand {
      display: flex; align-items: baseline; gap: 0.55rem;
      text-decoration: none !important; color: var(--ink) !important;
    }
    .brand-mark {
      font-family: var(--font-display); font-weight: 700;
      font-size: 1.15rem; letter-spacing: -0.02em; line-height: 1;
      white-space: nowrap;
    }
    .brand-tag {
      font-size: 0.78rem; font-weight: 500; color: var(--muted);
      letter-spacing: 0.02em;
    }
    .brand-by {
      font-size: 0.78rem; font-weight: 500; color: var(--muted);
      letter-spacing: 0.01em; white-space: nowrap;
    }
    .brand-by em {
      font-style: italic; font-weight: 600; color: var(--sage);
    }
    @media (max-width: 640px) {
      .brand-tag { display: none; }
      .brand-by { display: none; }
    }
    .site-nav {
      display: flex; align-items: center; gap: 0.15rem 1.1rem;
      flex-wrap: wrap; margin-left: auto; font-size: 0.92rem; font-weight: 500;
    }
    .site-nav a {
      color: var(--ink-soft); text-decoration: none !important;
      padding: 0.25rem 0; border-bottom: 2px solid transparent;
      transition: color 0.2s var(--ease), border-color 0.2s var(--ease);
    }
    .site-nav a:hover { color: var(--sage-deep); }
    .site-nav a[aria-current="page"] {
      color: var(--sage-deep); border-bottom-color: var(--sage);
    }

    /* —— Layout —— */
    .shell { max-width: var(--max); margin: 0 auto; padding: 0 clamp(1rem, 3vw, 2rem) 4rem; }
    main.docs {
      max-width: 48rem; margin: 0 auto;
      padding: 0 clamp(1rem, 3vw, 2rem) 4rem;
    }
    h2 {
      font-family: var(--font-display); font-weight: 650;
      font-size: clamp(1.35rem, 2.2vw, 1.65rem);
      letter-spacing: -0.02em; margin: 2.75rem 0 0.75rem; color: var(--ink);
    }
    h3 {
      font-family: var(--font-display); font-weight: 650;
      font-size: 1.1rem; margin: 1.6rem 0 0.45rem; color: var(--ink);
    }
    .muted { color: var(--muted); }
    .lead { font-size: 1.12rem; color: var(--muted); margin: 0.4rem 0 1.25rem; max-width: 40rem; }
    .docs p { margin: 0.65rem 0; color: var(--ink-soft); max-width: 40rem; }
    .docs p + p { margin-top: 0.85rem; }
    .docs ul, .docs ol { margin: 0.75rem 0 1.1rem; padding-left: 1.25rem; color: var(--ink-soft); }
    .docs li { margin: 0.35rem 0; }
    .docs li::marker { color: var(--sage); }

    /* —— Agent guide layout —— */
    .guide-hero {
      position: relative; isolation: isolate;
      margin: 0 calc(-1 * clamp(1rem, 3vw, 2rem));
      padding: clamp(2.25rem, 6vh, 3.5rem) clamp(1rem, 3vw, 2rem) clamp(2rem, 5vh, 3rem);
      background:
        radial-gradient(ellipse 70% 55% at 90% 0%, #d5e4dc 0%, transparent 55%),
        radial-gradient(ellipse 45% 40% at 5% 100%, #dde5eb 0%, transparent 50%),
        linear-gradient(168deg, #eef1f3 0%, #e6ece8 48%, #f3f5f7 100%);
      overflow: hidden;
    }
    .guide-hero::before {
      content: "";
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      opacity: 0.28;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M0 48V0h48' fill='none' stroke='%232f5d4e' stroke-opacity='0.07' stroke-width='1'/%3E%3C/svg%3E");
    }
    .guide-hero-inner {
      position: relative; z-index: 1;
      max-width: 40rem;
    }
    .guide-hero .lead { animation: rise 0.85s var(--ease) 0.06s both; }
    .guide-hero .guide-intro-body { animation: rise 0.85s var(--ease) 0.12s both; }
    .guide-hero .pull-quote { animation: rise 0.85s var(--ease) 0.18s both; }
    .guide-hero .section-kicker { animation: rise 0.75s var(--ease) both; }
    .guide-hero .guide-rule { animation: rule-grow 0.7s var(--ease) 0.1s both; }
    .guide-hero h2 {
      margin-top: 0; animation: rise 0.85s var(--ease) 0.04s both;
    }

    .guide-section {
      position: relative;
      padding: clamp(2.5rem, 6vh, 3.75rem) 0;
      border-top: 1px solid transparent;
    }
    .guide-section + .guide-section {
      border-top-color: var(--line);
    }
    .guide-section.is-alt {
      margin-left: calc(-1 * clamp(1rem, 3vw, 2rem));
      margin-right: calc(-1 * clamp(1rem, 3vw, 2rem));
      padding-left: clamp(1rem, 3vw, 2rem);
      padding-right: clamp(1rem, 3vw, 2rem);
      background: color-mix(in srgb, var(--sage-soft) 42%, var(--paper));
      border-top-color: #c5d9ce;
      border-bottom: 1px solid #c5d9ce;
    }
    .guide-section.is-alt + .guide-section {
      border-top-color: transparent;
    }
    .guide-section > .section-kicker {
      display: flex; align-items: center; gap: 0.65rem;
      margin-bottom: 0.65rem;
    }
    .guide-section > h2 {
      margin-top: 0; margin-bottom: 0.55rem;
    }
    .guide-section-head {
      display: flex; align-items: flex-start; gap: 0.85rem;
      margin-bottom: 0.25rem;
    }
    .guide-section-head .guide-icon {
      flex-shrink: 0; margin-top: 0.2rem;
    }
    .guide-section-head h2 { margin: 0; flex: 1; }

    .guide-rule {
      display: block; width: 100%; max-width: 12rem;
      height: 1px; margin: 0 0 1.25rem;
      background: linear-gradient(90deg, var(--sage) 0%, transparent 100%);
      opacity: 0.55;
      transform-origin: left center;
    }
    .guide-section.is-inview .guide-rule {
      animation: rule-grow 0.7s var(--ease) both;
    }

    .guide-icon {
      display: inline-flex; width: 1.65rem; height: 1.65rem;
      color: var(--sage);
    }
    .guide-icon svg { width: 100%; height: 100%; display: block; }

    .guide-benefits {
      display: grid; gap: 0;
      margin: 1.35rem 0 0;
    }
    .guide-benefit {
      display: grid; grid-template-columns: 2rem 1fr;
      gap: 0.85rem; align-items: start;
      padding: 1rem 0;
      border-bottom: 1px solid var(--line);
    }
    .guide-benefit:last-child { border-bottom: none; }
    .guide-benefit strong {
      display: block; color: var(--ink);
      font-family: var(--font-display); font-weight: 650;
      margin-bottom: 0.2rem;
    }
    .guide-benefit p {
      margin: 0; color: var(--ink-soft); max-width: none;
    }

    .session-flow {
      margin: 1.25rem 0 1.5rem;
      padding: 1.1rem 0.85rem 0.85rem;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow-x: auto;
    }
    .session-flow svg {
      display: block; width: 100%; min-width: 36rem; height: auto;
    }
    .session-flow-caption {
      margin: 0.65rem 0 0; font-size: 0.85rem; color: var(--muted);
      text-align: center;
    }

    .guide-cta-row {
      display: flex; flex-wrap: wrap; gap: 0.65rem;
      margin: 1.25rem 0 0;
    }

    .reveal {
      opacity: 0; transform: translateY(0.85rem);
      transition: opacity 0.7s var(--ease), transform 0.7s var(--ease);
    }
    .reveal.is-inview {
      opacity: 1; transform: none;
    }
    .reveal-delay-1 { transition-delay: 0.06s; }
    .reveal-delay-2 { transition-delay: 0.12s; }
    .reveal-delay-3 { transition-delay: 0.18s; }

    @keyframes rule-grow {
      from { transform: scaleX(0); opacity: 0; }
      to { transform: scaleX(1); opacity: 0.55; }
    }

    /* —— Hero —— */
    .hero {
      position: relative; isolation: isolate;
      min-height: min(92vh, 52rem);
      display: grid; align-items: stretch;
      grid-template-columns: 1fr;
      overflow: hidden;
      background:
        radial-gradient(ellipse 80% 60% at 85% 20%, #d5e4dc 0%, transparent 55%),
        radial-gradient(ellipse 55% 45% at 10% 90%, #dde5eb 0%, transparent 50%),
        linear-gradient(165deg, #eef1f3 0%, #e4ebe7 42%, #f3f5f7 100%);
    }
    .hero::before {
      content: "";
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      opacity: 0.35;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M0 48V0h48' fill='none' stroke='%232f5d4e' stroke-opacity='0.07' stroke-width='1'/%3E%3C/svg%3E");
    }
    .hero-inner {
      position: relative; z-index: 1;
      display: grid; grid-template-columns: 1.05fr 0.95fr;
      gap: clamp(1.5rem, 4vw, 3.5rem);
      align-items: center;
      max-width: var(--max); width: 100%;
      margin: 0 auto;
      padding: clamp(2.5rem, 8vh, 5rem) clamp(1rem, 3vw, 2rem) clamp(2rem, 6vh, 4rem);
      min-height: inherit;
    }
    @media (max-width: 860px) {
      .hero { min-height: auto; }
      .hero-inner {
        grid-template-columns: 1fr;
        padding-top: 2.5rem; padding-bottom: 0;
        min-height: auto;
      }
      .hero-visual { order: -1; max-height: 14rem; }
    }
    .hero-copy { max-width: 34rem; }
    .hero-brand {
      font-family: var(--font-display); font-weight: 700;
      font-size: clamp(2.35rem, 6.5vw, 4.1rem);
      line-height: 1.02; letter-spacing: -0.035em;
      color: var(--ink); margin: 0 0 1.1rem;
      animation: rise 0.9s var(--ease) both;
    }
    .hero-brand em {
      font-style: italic; font-weight: 500; color: var(--sage);
    }
    .hero h2 {
      font-family: var(--font-display); font-weight: 650;
      font-size: clamp(1.35rem, 2.6vw, 1.85rem);
      letter-spacing: -0.02em; line-height: 1.25;
      margin: 0 0 0.85rem; color: var(--ink-soft);
      animation: rise 0.9s var(--ease) 0.08s both;
    }
    .hero-support {
      margin: 0 0 1.75rem; color: var(--muted);
      font-size: 1.08rem; max-width: 28rem;
      animation: rise 0.9s var(--ease) 0.14s both;
    }
    .hero-cta {
      display: flex; flex-wrap: wrap; gap: 0.65rem;
      animation: rise 0.9s var(--ease) 0.2s both;
    }
    .hero-visual {
      position: relative; width: 100%; aspect-ratio: 5 / 4;
      animation: fade-in 1.2s var(--ease) 0.15s both;
    }
    .hero-visual svg { width: 100%; height: 100%; display: block; }

    @keyframes rise {
      from { opacity: 0; transform: translateY(1.1rem); }
      to { opacity: 1; transform: none; }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }

    /* —— CTAs —— */
    .cta {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.7rem 1.25rem; border-radius: var(--radius);
      background: var(--sage); color: #fff !important;
      text-decoration: none !important; font-size: 0.95rem; font-weight: 600;
      border: 1px solid var(--sage);
      transition: background 0.2s var(--ease), transform 0.2s var(--ease);
    }
    .cta:hover { background: var(--sage-deep); border-color: var(--sage-deep); }
    .cta.secondary {
      background: transparent; color: var(--ink) !important;
      border-color: var(--line);
    }
    .cta.secondary:hover { border-color: var(--sage); color: var(--sage-deep) !important; }

    /* —— Sections —— */
    .section { padding: clamp(2.75rem, 7vh, 4.5rem) 0 0; }
    .section-kicker {
      font-size: 0.78rem; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--sage); margin: 0 0 0.5rem;
    }
    .section-support {
      margin: 0.35rem 0 1.35rem; color: var(--muted);
      font-size: 1.05rem; max-width: 36rem; line-height: 1.55;
    }
    .split {
      display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1.5rem, 4vw, 3rem);
      margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line);
    }
    @media (max-width: 700px) { .split { grid-template-columns: 1fr; } }
    .split h3 { margin-top: 0; }
    .split p { color: var(--muted); margin: 0.35rem 0 0; }

    .feature-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: clamp(1rem, 3vw, 1.75rem);
      margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line);
    }
    @media (max-width: 700px) { .feature-grid { grid-template-columns: 1fr; } }
    .feature-item h3 {
      margin: 0 0 0.35rem; font-size: 1.05rem;
    }
    .feature-item p {
      margin: 0; color: var(--muted); font-size: 0.98rem; max-width: 22rem;
    }

    .connect-list {
      list-style: none; margin: 1.25rem 0 0; padding: 0;
      border-top: 1px solid var(--line);
    }
    .connect-list li {
      display: grid; grid-template-columns: 9rem 1fr; gap: 1rem;
      padding: 0.85rem 0; border-bottom: 1px solid var(--line);
      align-items: baseline;
    }
    @media (max-width: 560px) {
      .connect-list li { grid-template-columns: 1fr; gap: 0.2rem; }
    }
    .connect-list .label {
      font-size: 0.82rem; font-weight: 600; color: var(--muted);
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .connect-list a { font-family: var(--font-mono); font-size: 0.9rem; word-break: break-all; }

    .card {
      background: var(--panel); border: 1px solid var(--line);
      border-radius: var(--radius); padding: 1.15rem 1.25rem; margin: 1rem 0;
    }
    .card h3 { margin-top: 0; }
    .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin: 1rem 0;
    }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    .flow {
      display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 1rem;
      align-items: center;
    }
    .chip {
      display: inline-block; padding: 0.28rem 0.6rem; border-radius: 4px;
      background: var(--sage-soft); color: var(--sage-deep);
      font-size: 0.78rem; font-weight: 600; border: 1px solid #c5d9ce;
      font-family: var(--font-mono);
    }
    .chip.arrow { background: transparent; border: none; color: var(--muted); padding: 0.25rem 0.15rem; font-family: var(--font-body); }
    .benefit {
      border-left: 3px solid var(--sage); padding-left: 0.95rem; margin: 0.9rem 0;
    }

    /* —— Readable patterns —— */
    .pull-quote {
      margin: 1.75rem 0;
      padding: 0.25rem 0 0.25rem 1.15rem;
      border-left: 3px solid var(--sand);
      font-family: var(--font-display);
      font-size: clamp(1.15rem, 2vw, 1.35rem);
      font-weight: 500; font-style: italic;
      line-height: 1.4; color: var(--ink-soft);
      max-width: 34rem;
    }
    .pull-quote cite {
      display: block; margin-top: 0.55rem;
      font-family: var(--font-body); font-style: normal;
      font-size: 0.82rem; font-weight: 600; color: var(--muted);
      letter-spacing: 0.02em;
    }
    .callout {
      margin: 1.35rem 0;
      padding: 1rem 1.15rem;
      background: var(--sage-soft);
      border-radius: var(--radius);
      border: 1px solid #c5d9ce;
    }
    .callout strong { color: var(--sage-deep); }
    .callout p { margin: 0.35rem 0 0; color: var(--ink-soft); max-width: none; }
    .callout.warn {
      background: #f7f1e4;
      border-color: #e0d0a8;
    }
    .callout.warn strong { color: #7a5f28; }
    .steps {
      list-style: none; margin: 1.25rem 0 1.5rem; padding: 0;
      counter-reset: step;
    }
    .steps li {
      position: relative;
      counter-increment: step;
      padding: 0.85rem 0 0.85rem 2.75rem;
      border-bottom: 1px solid var(--line);
      color: var(--ink-soft);
    }
    .steps li:last-child { border-bottom: none; }
    .steps li::before {
      content: counter(step);
      position: absolute; left: 0; top: 0.85rem;
      width: 1.85rem; height: 1.85rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: var(--sage); color: #fff;
      font-family: var(--font-display); font-size: 0.85rem; font-weight: 650;
    }
    .steps li strong {
      display: block; color: var(--ink);
      font-family: var(--font-display); font-weight: 650;
      margin-bottom: 0.2rem;
    }
    .beat {
      display: grid; grid-template-columns: 5.5rem 1fr;
      gap: 0.85rem; margin: 0.85rem 0;
      padding: 0.9rem 0; border-bottom: 1px solid var(--line);
      align-items: start;
    }
    .beat:last-child { border-bottom: none; }
    @media (max-width: 560px) {
      .beat { grid-template-columns: 1fr; gap: 0.25rem; }
    }
    .beat-who {
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--sage);
      padding-top: 0.15rem;
    }
    .beat-who.user { color: var(--muted); }
    .beat-body { margin: 0; color: var(--ink-soft); font-size: 0.98rem; }
    .beat-body p { margin: 0.3rem 0 0; }
    .scenario-list {
      list-style: none; margin: 1.25rem 0 0; padding: 0;
    }
    .scenario-list li {
      padding: 1rem 0; border-bottom: 1px solid var(--line);
    }
    .scenario-list li:first-child { border-top: 1px solid var(--line); }
    .scenario-list h3 {
      margin: 0 0 0.3rem; font-size: 1.05rem;
    }
    .scenario-list p { margin: 0; color: var(--muted); max-width: 38rem; }
    .rhythm-fade {
      animation: rise 0.8s var(--ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .hero-brand, .hero h2, .hero-support, .hero-cta, .hero-visual,
      .rhythm-fade,
      .guide-hero .section-kicker, .guide-hero h2, .guide-hero .lead,
      .guide-hero .guide-intro-body, .guide-hero .pull-quote,
      .guide-hero .guide-rule,
      .guide-section.is-inview .guide-rule { animation: none !important; }
      .path-line, .flow-path { animation: none !important; stroke-dashoffset: 0 !important; }
      .reveal {
        opacity: 1 !important; transform: none !important;
        transition: none !important;
      }
    }

    table {
      width: 100%; border-collapse: collapse; font-size: 0.92rem; margin: 0.75rem 0 1.25rem;
    }
    th, td {
      text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
    footer.site-footer {
      margin-top: 3.5rem; padding-top: 1.25rem; border-top: 1px solid var(--line);
      color: var(--muted); font-size: 0.88rem;
    }
    footer.site-footer .footer-brand {
      font-family: var(--font-display); font-weight: 650;
      font-size: 1.05rem; color: var(--ink); margin: 0 0 0.4rem;
    }
    footer.site-footer .footer-eco {
      margin: 0 0 0.75rem; max-width: 36rem; line-height: 1.5;
    }
    footer.site-footer .footer-meta {
      margin: 0; font-size: 0.82rem;
    }
    footer.site-footer nav.footer-links {
      display: flex; flex-wrap: wrap; gap: 0.65rem 1.1rem;
      margin: 0.85rem 0 0; font-size: 0.88rem;
    }
    footer.site-footer nav.footer-links a {
      color: var(--ink-soft); text-decoration: none !important;
    }
    footer.site-footer nav.footer-links a:hover { color: var(--sage-deep); }
    .eco-note {
      margin: 1.25rem 0 0; padding: 1rem 1.15rem;
      background: color-mix(in srgb, var(--sage-soft) 55%, var(--paper));
      border: 1px solid #c5d9ce; border-radius: var(--radius);
      color: var(--ink-soft); font-size: 0.98rem; max-width: 40rem;
    }
    .eco-note p { margin: 0; color: inherit; max-width: none; }
    .eco-note p + p { margin-top: 0.55rem; }
  `;
}

/** Small line icons for the agent guide (24×24 viewBox). */
export type GuideIconName =
  | "pace"
  | "languages"
  | "source"
  | "pdf"
  | "loop"
  | "tools"
  | "rules"
  | "chat";

export function guideIcon(name: GuideIconName): string {
  const paths: Record<GuideIconName, string> = {
    pace: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    languages: `<path d="M4 6h10M9 6v2c0 4-2 7-5 9M7 10h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M14 18l2.5-7h1L20 18M15.2 15.5h3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    source: `<path d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M14 4v4h4M9 13h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    pdf: `<rect x="5" y="3" width="14" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    loop: `<path d="M4 12a6 6 0 0 1 10-4l2-2v6h-6l2-2a4 4 0 1 0 0 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    tools: `<path d="M14.5 5.5l4 4M9 7l-4 1 3 3-1 5 5-1 3-3 1-4-4 1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
    rules: `<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9.5 12l1.8 1.8L15 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    chat: `<path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  };
  return `<span class="guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${paths[name]}</svg></span>`;
}

/** Horizontal session-flow diagram with draw-on-view path. */
export function sessionFlowSvg(): string {
  return `<div class="session-flow" role="img" aria-label="Session flow from intro through conclusion">
  <svg viewBox="0 0 720 88" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path class="flow-path" d="M28 44 H692"
      stroke="#c5d9ce" stroke-width="2" stroke-linecap="round"
      stroke-dasharray="680" stroke-dashoffset="680"/>
    <g font-family="Source Sans 3, Segoe UI, sans-serif" font-size="10.5" font-weight="600" fill="#1e3f35">
      <g transform="translate(28,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">intro</text></g>
      <g transform="translate(94,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">frames</text></g>
      <g transform="translate(168,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">community</text></g>
      <g transform="translate(250,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">m1</text></g>
      <g transform="translate(318,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">m2</text></g>
      <g transform="translate(386,44)"><circle r="7" fill="#4a7a68"/><text y="28" text-anchor="middle">drafting</text></g>
      <g transform="translate(458,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">m3</text></g>
      <g transform="translate(526,44)"><circle r="7" fill="#4a7a68"/><text y="28" text-anchor="middle">checking</text></g>
      <g transform="translate(594,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">m4</text></g>
      <g transform="translate(648,44)"><circle r="7" fill="#2f5d4e"/><text y="28" text-anchor="middle">m5</text></g>
      <g transform="translate(692,44)"><circle r="7" fill="#1e3f35"/><text y="28" text-anchor="middle">end</text></g>
    </g>
  </svg>
  <p class="session-flow-caption">Pace with <code>part</code> · advance only when the team is ready</p>
</div>`;
}

/** Intersection reveal + session-flow draw for the agent guide. */
export function guidePageScript(): string {
  return `<script>
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nodes = document.querySelectorAll(".guide-section, .reveal");
  if (!nodes.length) return;
  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach(function (el) { el.classList.add("is-inview"); });
    document.querySelectorAll(".flow-path").forEach(function (p) {
      p.style.strokeDashoffset = "0";
    });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-inview");
      if (entry.target.classList.contains("guide-section")) {
        var path = entry.target.querySelector(".flow-path");
        if (path && !path.dataset.drawn) {
          path.dataset.drawn = "1";
          path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)";
          path.style.strokeDashoffset = "0";
        }
      }
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  nodes.forEach(function (el) { io.observe(el); });
})();
</script>`;
}

/** MCP tools + session path illustration for the hero (inline SVG). */
export function heroVisualSvg(): string {
  return `<svg viewBox="0 0 560 448" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
  <title>MCP tools for OBS Theological Formation</title>
  <rect x="36" y="48" width="300" height="360" rx="4" fill="#fff" stroke="#c5d0d8" stroke-width="1.5"/>
  <rect x="56" y="72" width="160" height="10" rx="2" fill="#d5e4dc"/>
  <text x="56" y="108" font-family="IBM Plex Mono, Consolas, monospace" font-size="11" fill="#5c6b76">tools/</text>
  <g font-family="IBM Plex Mono, Consolas, monospace" font-size="12" fill="#1e3f35">
    <rect x="56" y="120" width="260" height="28" rx="3" fill="#eef4f1" stroke="#b7cfc3"/>
    <text x="68" y="138">fetch_obs_study_manual</text>
    <rect x="56" y="158" width="200" height="26" rx="3" fill="#f7f9fa" stroke="#d3dce3"/>
    <text x="68" y="175" fill="#5c6b76">list_languages</text>
    <rect x="56" y="194" width="200" height="26" rx="3" fill="#f7f9fa" stroke="#d3dce3"/>
    <text x="68" y="211" fill="#5c6b76">get_framework</text>
    <rect x="56" y="230" width="200" height="26" rx="3" fill="#f7f9fa" stroke="#d3dce3"/>
    <text x="68" y="247" fill="#5c6b76">list_stories</text>
  </g>
  <text x="56" y="300" font-family="Source Sans 3, Segoe UI, sans-serif" font-size="12" fill="#5c6b76">part → sessionFlow</text>
  <g opacity="0.95">
    <rect x="56" y="312" width="52" height="22" rx="3" fill="#e4efe9" stroke="#b7cfc3"/>
    <rect x="116" y="312" width="58" height="22" rx="3" fill="#e4efe9" stroke="#b7cfc3"/>
    <rect x="182" y="312" width="62" height="22" rx="3" fill="#e4efe9" stroke="#b7cfc3"/>
    <rect x="252" y="312" width="48" height="22" rx="3" fill="#d5e4dc" stroke="#2f5d4e"/>
  </g>
  <path class="path-line" d="M400 80 C430 120, 390 160, 430 200 C470 240, 400 280, 440 320 C480 360, 420 390, 460 420"
    stroke="#2f5d4e" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="420" stroke-dashoffset="420"
    style="animation: draw 2.2s cubic-bezier(0.22,1,0.36,1) 0.4s forwards"/>
  <g font-family="Literata, Georgia, serif" font-size="13" fill="#1e3f35" font-weight="600">
    <circle cx="400" cy="80" r="9" fill="#2f5d4e"/><text x="400" y="84" text-anchor="middle" fill="#fff" font-size="11">1</text>
    <text x="418" y="84">Observe</text>
    <circle cx="430" cy="200" r="9" fill="#2f5d4e"/><text x="430" y="204" text-anchor="middle" fill="#fff" font-size="11">2</text>
    <text x="448" y="204">Discuss</text>
    <circle cx="440" cy="320" r="9" fill="#2f5d4e"/><text x="440" y="324" text-anchor="middle" fill="#fff" font-size="11">3</text>
    <text x="458" y="324">Draft · Check</text>
    <circle cx="460" cy="420" r="9" fill="#2f5d4e"/><text x="460" y="424" text-anchor="middle" fill="#fff" font-size="11">4</text>
    <text x="398" y="442" text-anchor="end">Serve · Share</text>
  </g>
</svg>`;
}

export function siteHeader(base: string, active: "home" | "docs" | "chat" | "debug"): string {
  const link = (href: string, label: string, key: typeof active) =>
    `<a href="${base}${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a>`;
  return `
  <header class="site-header" id="siteHeader">
    <a class="brand" href="${base}/">
      <span class="brand-mark">OBS-TF MCP</span>
      <span class="brand-by">by <em>BT Servant</em></span>
      <span class="brand-tag">MCP server · OBS Theological Formation</span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      ${link("/", "Home", "home")}
      ${link("/docs", "Guide", "docs")}
      <a href="${base}/api/mcp-manifest">Manifest</a>
      ${link("/chat", "Chat", "chat")}
      ${link("/debug", "X-ray", "debug")}
    </nav>
  </header>
  <script>
    (function () {
      var h = document.getElementById("siteHeader");
      if (!h) return;
      var onScroll = function () { h.classList.toggle("is-scrolled", window.scrollY > 8); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    })();
  </script>`;
}

/** Shared footer — product first, BT Servant ecosystem framing. */
export function siteFooter(options?: {
  extraMeta?: string;
}): string {
  const meta = options?.extraMeta
    ? `<p class="footer-meta">${options.extraMeta}</p>`
    : `<p class="footer-meta">CC BY-SA 4.0 study content · MCP server by unfoldingWord</p>`;
  return `
    <footer class="site-footer">
      <p class="footer-brand">OBS-TF MCP</p>
      <p class="footer-eco">
        Part of the
        <a href="https://www.btservant.ai/" target="_blank" rel="noopener">BT Servant</a>
        ecosystem — a Model Context Protocol server for OBS Theological Formation manuals.
      </p>
      ${meta}
      <nav class="footer-links" aria-label="Ecosystem">
        <a href="https://www.btservant.ai/" target="_blank" rel="noopener">BT Servant</a>
        <a href="https://tc-helps.mcp.servant.bible/v2/" target="_blank" rel="noopener">Translation Helps MCP</a>
        <a href="https://formationstories.org/introduction/" target="_blank" rel="noopener">Formation Stories</a>
      </nav>
    </footer>`;
}
