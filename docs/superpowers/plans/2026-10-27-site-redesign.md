# OBS-TF MCP site redesign implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current site with a new SvelteKit site built from scratch. It explains OBS-TF MCP, lets anyone try it in the browser with no key, and gives PRs preview URLs.

**Architecture:**
- **Worker:** keeps `/mcp`, `/api/tool`, `/api/mcp-manifest`, `/api`, `/health` and `/assets/pdf/*`. It adds `/llms.txt` and redirects. Everything else comes from the static build in `web/dist`.
- **Pages:** prerendered by SvelteKit. Tool docs come from the server's own registry at build time.
- **Live data:** in the browser, through a small JSON-RPC client against same-origin `/mcp`.

**Tech stack:**
- Cloudflare Workers, TypeScript, Vitest.
- SvelteKit 2 + Svelte 5 with `adapter-static`, Tailwind v4 (as a utility layer only).
- `marked` + `isomorphic-dompurify`, `zod-to-json-schema`.
- Playwright for the smoke test.
- Fonts: Geist and Geist Mono (Google Fonts).

**Spec:** `docs/superpowers/specs/2026-10-27-site-redesign-design.md`

**Repo rule:** commit only when Abel says so (workspace `CLAUDE.md`). The "Commit" steps below are the points where a commit belongs once he agrees. The work stays in worktree `C:/Users/LENOVO/Git/Github/obs-5m-mcp-site`, branch `feat/site-redesign`.

## Global constraints

- **Clean slate:** no text, CSS, components or class names copied from the current site (`src/docs/*`, `web/src/*`). Every statement is checked against the code, the server instructions, Door43 or formationstories.org.
- **Naming:**
  - Display name "OBS-TF MCP", defined once in `web/src/lib/site.ts` (`SITE.name`).
  - The content is "Open Bible Stories + Theological Formation".
  - The "also called 5M OBS, after its Five Movements" line appears once, on the home page.
- **Language:** English only, sentence case, no exclamation marks.
- **People words:** "community", "leaders", "translation team". Never "instructor", "student" or "facilitator mode".
- **Guided session views:** "Leader view" sets `include_answers: true`; "Community view" sets `include_answers: false`.
- **Type:** Geist (400, 500) for text, Geist Mono for URLs, code and tool names.
- **Dark tokens (default):**

  | Token | Value |
  |---|---|
  | `--bg` | `#121815` |
  | `--surface` | `#18201C` |
  | `--border` | `#2A332E` |
  | `--border-strong` | `#3A463F` |
  | `--text` | `#EDE6D6` |
  | `--text-2` | `#A9B3A9` |
  | `--accent` | `#C9A35C` |
  | `--accent-2` | `#7FA38E` |

- **Light tokens:**

  | Token | Value |
  |---|---|
  | `--bg` | `#F6F1E7` |
  | `--surface` | `#FFFDF8` |
  | `--border` | `#E2D9C6` |
  | `--border-strong` | `#D6CCB7` |
  | `--text` | `#1E2B25` |
  | `--text-2` | `#4A5A52` |
  | `--accent` | `#2F5D50` |
  | `--accent-2` | `#8A6A33` |

- **Theme:** follows `prefers-color-scheme`. A manual toggle stores `light` or `dark` in `localStorage`, read inside try/catch.
- **Layout:** no horizontal scroll at 375px width. Text columns max 720px.
- **External links,** exactly these:

  | Name | URL |
  |---|---|
  | Formation Stories | `https://formationstories.org/` |
  | Open Bible Stories | `https://www.openbiblestories.org/` |
  | Strategic Mission Collective | `https://strategicmissioncollective.org/` |
  | Door43 | `https://door43.org` |
  | en_obs-tf | `https://git.door43.org/unfoldingWord/en_obs-tf` |
  | id_obs-tf | `https://git.door43.org/unfoldingWord/id_obs-tf` |
  | en_obs-tf overview | `https://git.door43.org/unfoldingWord/en_obs-tf/src/branch/master/transclusions/overview.md` |
  | unfoldingWord content | `https://unfoldingword.org/for-translators/content/` |
  | License | `https://creativecommons.org/licenses/by-sa/4.0/` |
  | GitHub | `https://github.com/unfoldingWord/obs-5m-mcp` |

- **Endpoint shown:** `${origin}/mcp`, where the origin is the page's own origin. A preview shows its own URL.
- **Redirects (301):** `/chat` → `/try` and `/debug` → `/try?tab=tools`.
- **No AI:** no chat and no OpenAI. `OPENAI_API_KEY` disappears from code and docs.

## Review focus

1. **A language or story without content** (for example Indonesian story with no data). `fetch_obs_study_manual` answers `available: false`. Expected: a plain sentence ("No Indonesian content for story 3 yet"), not an error box or a blank pane. Pinned in Task 3 (`classifyOutcome`) and Task 8 (guided session).
2. **Door43 down, or HTTP 429 from the rate limit.** Expected:
   - Door43 down: "Couldn't reach Door43. Retry" with a working retry.
   - 429: the wait in seconds.
   - Pinned in Task 3.
3. **Hostile or broken input from a shared link or Door43:**
   - a hand-edited `#…` hash (bad JSON, unknown tool, extra keys) must not crash `/try`; it falls back to defaults;
   - markdown from Door43 is rendered only after sanitizing (`<script>`, `onerror=` removed).
   - Pinned in Task 4 (hash) and Task 5 (markdown).
4. **A server without `include_answers`** (`master` before PR #18 merges). Expected: the Leader view / Community view switch is hidden, and the guided session still works. Pinned in Task 8.
5. **A phone-width viewport.** Expected: no horizontal scroll on `/`, `/try`, `/connect`, `/tools` and `/docs`. Code blocks scroll inside themselves. Pinned in Task 11.

---

### Task 1: Worker routes for the new site

**Files:**
- Delete:
  - `src/chat/` (whole folder)
  - `src/docs/` (whole folder)
  - `src/core/xray/debugPage.ts`
  - `scripts/eval-chat.ts`
  - `tests/unit/chat-toolSpecs.test.ts`, `tests/unit/docsPages.test.ts`, `tests/unit/mcp-connect-setup.test.ts`, `tests/unit/obs-intent.test.ts`
- Create:
  - `src/core/discovery.ts`
  - `src/core/llmsTxt.ts`
  - `tests/unit/site-routes.test.ts`
- Modify:
  - `src/worker.ts`: drop the imports and routes for chat, docs and debug; add redirects and `/llms.txt`; `/` and other paths fall through to `ASSETS`.
  - `package.json`: drop the `test:chat-eval` script.
  - `.env.example`: drop the `OPENAI_API_KEY` lines.
  - `tests/unit/xray.test.ts`: keep only what still exists.
  - `src/mcp/instructions.ts`: drop references to `/chat` or `/debug`, if any.

**Interfaces:**
- Produces:
  - `apiDiscoveryJson(baseUrl: string, version: string, name: string): { name, version, mcp, tools, connect, docs, manifest, health, tool, llms, urls: { mcp, site } }`, with paths `/mcp`, `/tools`, `/connect`, `/docs`, `/api/mcp-manifest`, `/health`, `/api/tool` and `/llms.txt`.
  - `buildLlmsTxt(baseUrl: string): string`:
    - first line `# OBS-TF MCP`;
    - then a one-paragraph summary;
    - then `## Endpoint` with `${base}/mcp`;
    - then `## Tools`, with one line per tool in `MCP_TOOLS` order: `- name: first sentence of description`;
    - then `## Links`, with the site pages and the Formation Stories and Door43 URLs.

- [ ] **Step 1: Write failing tests in `tests/unit/site-routes.test.ts`** (call `worker.fetch` with a stub `ASSETS` that returns `new Response("asset:" + pathname)`)
  - `GET /chat` → 301, `Location` ends with `/try`.
  - `GET /debug` → 301, `Location` ends with `/try?tab=tools`.
  - `GET /llms.txt` → 200, `text/plain`, starts with `# OBS-TF MCP`, contains `/mcp` and every tool name in `MCP_TOOLS`.
  - `GET /` with `Accept: text/html` → body `asset:/`.
  - `GET /` with `Accept: application/json` → JSON whose `mcp` is `/mcp` and with no `chat` key.
  - `POST /api/chat` → not 200: the route is gone and the request reaches `ASSETS`.
  - `GET /health` → 200, unchanged.
- [ ] **Step 2: Run** `npx vitest run tests/unit/site-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/core/discovery.ts`, `src/core/llmsTxt.ts` and the `src/worker.ts` changes. Delete the listed files.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run`. Expected: all pass, with no imports left of `src/chat` or `src/docs` (`grep -rn "src/chat\|src/docs\|/chat\b" src` → nothing).
- [ ] **Step 5: Commit** "Serve the site from static assets and drop the chat and docs pages".

### Task 2: Web app reset, design tokens and site shell

**Files:**
- Delete: everything under `web/src/` except `app.d.ts`; `web/static/favicon.svg` (a new one is made here).
- Create:
  - `web/src/app.html`: loads Geist and Geist Mono from Google Fonts; runs an inline theme bootstrap script before paint.
  - `web/src/app.css`: tokens (Global constraints), base type, focus ring, `.prose` styles for rendered markdown.
  - `web/src/lib/site.ts`
  - `web/src/lib/theme.ts`
  - `web/src/lib/components/SiteHeader.svelte`, `SiteFooter.svelte`, `ThemeToggle.svelte`
  - `web/src/routes/+layout.svelte`, `+layout.ts` (`export const prerender = true`)
  - `web/static/favicon.svg`: a simple ochre square mark.
- Modify:
  - `web/vite.config.ts`: proxy only `/mcp`, `/api` and `/health` to `:8790`; drop the `$chat`, `$core` and `$content` aliases that are no longer needed (keep `$mcp`).
  - `web/svelte.config.js`: aliases to match.
  - `web/package.json`: drop `lucide-svelte` if unused.

**Interfaces:**
- Produces:
  - `SITE: { name: "OBS-TF MCP", repo: string, links: Record<'formationStories'|'openBibleStories'|'smc'|'door43'|'enRepo'|'idRepo'|'overview'|'uwContent'|'license', string> }`
  - `nav: { href: '/try'|'/connect'|'/tools'|'/docs', label: string }[]`
  - `getTheme(): 'light'|'dark'`
  - `setTheme(t: 'light'|'dark'): void`: sets `document.documentElement.dataset.theme` and stores the choice.
- Header: name, a "read-only" badge, the nav, a GitHub link and a primary "Try it" button. The footer links follow spec §Home 8.

- [ ] **Step 1: Write** the files above. CSS tokens go on `:root[data-theme=dark]` and `:root[data-theme=light]`, with `prefers-color-scheme` as the default when no theme attribute is set.
- [ ] **Step 2: Run** `npm run check --prefix web && npm run build --prefix web`. Expected: 0 errors, and `web/dist/index.html` exists.
- [ ] **Step 3: Commit** "Start the new site shell and design tokens".

### Task 3: Browser MCP client with request log and outcome classes

**Files:**
- Create: `web/src/lib/mcp/client.ts`, `web/src/lib/mcp/outcome.ts`, `tests/web/mcp-client.test.ts`
- Modify: `vitest.config.ts`, so it includes `tests/web/**/*.test.ts`.

**Interfaces:**
- **Types:**
  - `type Exchange = { request: unknown; response: unknown; status: number; bytes: number; ms: number }`
  - `type ToolInfo = { name: string; description: string; inputSchema: JsonSchema; annotations?: { readOnlyHint?: boolean; title?: string } }`
  - `type CallResult = { text: string; structured: Record<string, unknown> | null; isError: boolean; exchange: Exchange }`
- **`class McpHttpClient`:**
  - `constructor(endpoint: string, fetchImpl = fetch)`
  - `initialize(): Promise<void>`: POSTs `initialize`, keeps the `Mcp-Session-Id` response header, then sends `notifications/initialized`.
  - `listTools(): Promise<ToolInfo[]>`
  - `callTool(name: string, args: Record<string, unknown>): Promise<CallResult>`
  - `readonly log: Exchange[]`
  - Requests send `Accept: application/json, text/event-stream`.
  - Responses are parsed as JSON, or as SSE where the last `data:` line is the JSON-RPC message.
- **`parseRpcBody(contentType: string, body: string): unknown`** (exported, for tests).
- **`classifyOutcome(input: { status: number; result?: CallResult; error?: unknown; retryAfter?: string | null }): Outcome`**, where `type Outcome` is one of:
  - `{ kind: 'ok' }`
  - `{ kind: 'not-available'; message: string }`, from `structured.available === false`, using its `message`;
  - `{ kind: 'upstream'; message: string }`: a JSON-RPC error or tool error whose text contains `UPSTREAM_DCS_ERROR`;
  - `{ kind: 'rate-limited'; retryAfterSeconds: number }`: HTTP 429, read from `Retry-After`, default 60;
  - `{ kind: 'error'; message: string }`

- [ ] **Step 1: Write failing tests:**
  - `parseRpcBody` reads a JSON body and an SSE body (`event: message\ndata: {...}\n\n`) to the same object.
  - With a fake `fetchImpl`, `initialize()` stores the session id and sends it on the next request (assert the header).
  - `callTool` fills `log` with one `Exchange` whose `bytes` equals the response body length.
  - `classifyOutcome` returns each of the five kinds from fixtures, including `{ available: false, message: "No …" }` → `not-available` and a 429 with `Retry-After: 30` → `retryAfterSeconds: 30`.
- [ ] **Step 2: Run** `npx vitest run tests/web/mcp-client.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. Use no MCP SDK in the browser: the client is about 100 lines, and owning it makes the request log trivial.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** "Add the browser MCP client used by the try page".

### Task 4: Schema-to-form fields and shareable try state

**Files:**
- Create: `web/src/lib/try/fields.ts`, `web/src/lib/try/hashState.ts`, `tests/web/try-state.test.ts`

**Interfaces:**
- **`fieldsFromSchema(schema: JsonSchema): Field[]`**, where `type Field` is:
  - `{ key: string; label: string; kind: 'select'|'switch'|'number'|'text'; required: boolean; options?: string[]; min?: number; max?: number; default?: unknown; description?: string }`
  - Mapping: `enum` → select, `boolean` → switch, `integer`/`number` → number with min/max, everything else → text.
  - Order: required fields first, then schema order.
- **`argsFromValues(fields: Field[], values: Record<string, unknown>): Record<string, unknown>`**: drops empty optional values and casts numbers.
- **`type TryState = { tab: 'guided'|'tools'; tool?: string; args?: Record<string, unknown>; lang?: string; story?: number; part?: string; view?: 'leader'|'community' }`**
- **`encodeTryState(s: TryState): string`**: returns `#` plus base64url of the JSON.
- **`decodeTryState(hash: string, knownTools: string[]): TryState`**: never throws. On any problem it returns `{ tab: 'guided' }`. It drops unknown keys and an unknown `tool`.

- [ ] **Step 1: Write failing tests:**
  - Using `fetchObsStudyManualTool`'s schema converted with `zodToJsonSchema`, `part` comes out as a select with the 12 `STUDY_MANUAL_PARTS`, `movement` as a number with min 1 and max 5, and `reference` as required text.
  - `argsFromValues` drops `''` and `undefined`.
  - Round trip `decodeTryState(encodeTryState(s))` equals `s`.
  - `decodeTryState('#%%%', [...])`, `decodeTryState('#' + btoa('{"tool":"rm"}'), ['list_stories'])` and `decodeTryState('', [])` all return `{ tab: 'guided' }`.
- [ ] **Step 2: Run** `npx vitest run tests/web/try-state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** "Generate tool forms from schemas and share try links".

### Task 5: Shared UI components

**Files:**
- Create in `web/src/lib/components/`: `Button.svelte`, `CopyPill.svelte`, `CodeTabs.svelte`, `Callout.svelte`, `Markdown.svelte`, `ResultViewer.svelte`, `ToolForm.svelte`
- Create: `web/src/lib/markdown.ts`, `tests/web/markdown.test.ts`

**Interfaces:**
- **`renderMarkdown(md: string): string`:** `marked` then DOMPurify, allowing headings, lists, emphasis, links (`rel="noopener"`, `target="_blank"`), code, blockquote and tables.
- **Components:**
  - `Button`: props `variant: 'primary'|'secondary'`, `href?`.
  - `CopyPill`: prop `value: string`. Shows the value in mono and a copy button; shows "Copied" for 1.5 s.
  - `CodeTabs`: prop `tabs: { label: string; code: string; lang?: string }[]`. Each tab has a copy button, and the code scrolls horizontally inside its box.
  - `Callout`: props `tone: 'note'|'warn'` plus a slot.
  - `ResultViewer`:
    - props `result: CallResult | null`, `outcome: Outcome | null`, `pending: boolean`;
    - tabs "Rendered", "JSON" and "JSON-RPC";
    - a meta line with the tool name, `bytes` formatted as KB with one decimal, and `ms`;
    - every non-ok `Outcome` shows as a `Callout` with the spec wording, and `upstream` gets a "Retry" button that emits `retry`.
  - `ToolForm`: props `fields: Field[]`, `values`. Emits `run`.

- [ ] **Step 1: Write failing tests** for `renderMarkdown`:
  - `'<img src=x onerror=alert(1)>'` has no `onerror`;
  - `'<script>x</script>'` has no `<script`;
  - `'#### 01-05\n- **Q:** a'` gives an `<h4>` and a `<li>`.
- [ ] **Step 2: Run** `npx vitest run tests/web/markdown.test.ts`. Expected: FAIL. Then implement `markdown.ts`.
- [ ] **Step 3: Implement** the components.
- [ ] **Step 4: Run** `npx vitest run tests/web && npm run check --prefix web`. Expected: PASS, 0 errors.
- [ ] **Step 5: Commit** "Add the site's shared components".

### Task 6: Home page with the story anatomy explorer

**Files:**
- Create:
  - `web/src/routes/+page.svelte`
  - `web/src/lib/anatomy/parts.ts`
  - `web/src/lib/anatomy/AnatomyExplorer.svelte`
  - `web/src/lib/home/examples.ts`
  - `scripts/build-anatomy-snapshot.ts`
  - `web/src/lib/anatomy/snapshot.json` (generated, committed)
- Modify: `package.json`, so `build:web` runs `tsx scripts/build-anatomy-snapshot.ts` first.

**Interfaces:**
- **`ANATOMY_PARTS: { part: StudyManualPart; title: string; group: 'story'|'movements'; contains: string[]; ask: string; call: { reference: string; part: string; include_answers?: false } }[]`**
  - The nine entries of spec §Facts, in that order, with the official movement titles from formationstories.org/introduction.
  - Movement 1's `call` is `{ reference: '1:5-8', part: 'movement1', include_answers: false }`. The others use `reference: '1'`.
- **`buildAnatomySnapshot(): Record<StudyManualPart, string>`** (script): for each part, the first ~600 characters of `formatStudyManualMd`, built from the `tests/fixtures/en_obs_tf` story 1 bundle (reuse the loader in `tests/unit/studyManual.test.ts` by moving it to `tests/fixtures/loadStory1.ts`).
- **`HOME_EXAMPLES: { ask: string; tool: string; args: Record<string, unknown> }[]`**: 5 entries covering `fetch_obs_study_manual` (part, range), `list_stories`, `search_content` and `list_languages`.
- **Page sections,** in this order (spec §Home):
  1. Hero: `CopyPill` with the endpoint, "Install in Cursor", "Try it", and "No key, no sign-up, read-only". This task creates `web/src/lib/connect/clients.ts` with `cursorDeeplink` and `vscodeDeeplink` (signatures in Task 9). Task 9 adds `CLIENTS` and the tests.
  2. What the server offers.
  3. What OBS + Theological Formation is, with the links in this order: Formation Stories, Open Bible Stories, Door43, repos, unfoldingWord, license. It ends with "This server serves the Door43 edition, which adds translation training: drafting and checking inside Movements 2–5" and a note that Part One is not served.
  4. Anatomy.
  5. What you can ask: each example links to `/try` with `encodeTryState`.
  6. Who uses it (BT Servant).
  7. Connect teaser.
- **The explorer** fetches the live excerpt through `McpHttpClient` when a part is selected. If that fails, it shows the snapshot with the label "Saved example".

- [ ] **Step 1: Write a failing test** `tests/web/anatomy.test.ts`: `ANATOMY_PARTS` has 9 entries; their `part` values are a subset of `STUDY_MANUAL_PARTS`; `buildAnatomySnapshot()` returns a non-empty string for each, and `movement1` contains `01-05`.
- [ ] **Step 2: Run** it. Expected: FAIL. Then implement `parts.ts`, the script and the fixture loader move.
- [ ] **Step 3: Implement** the page and the explorer. Write the copy fresh from spec §Facts.
- [ ] **Step 4: Run** `npx vitest run && npm run build:web`. Expected: PASS, and `web/dist/index.html` contains "Open Bible Stories + Theological Formation" and `formationstories.org`.
- [ ] **Step 5: Commit** "Add the home page and story anatomy".

### Task 7: Tools reference page

**Files:**
- Create: `web/src/lib/catalog.ts`, `web/src/routes/tools/+page.svelte`, `web/src/routes/tools/+page.ts`, `tests/web/catalog.test.ts`

**Interfaces:**
- **`buildToolCatalog(): ToolDoc[]`**, from `MCP_TOOLS` (`$mcp/toolRegistry`), where `type ToolDoc = { name; title; description; readOnly: boolean; inputSchema: JsonSchema; group: 'primary'|'discovery'|'helpers' }`.
  - Group `primary`: `fetch_obs_study_manual`.
  - Group `discovery`: `list_languages`, `list_resources`, `list_collections`, `list_stories`, `get_framework`.
  - Group `helpers`: the rest.
  - Sorted primary, discovery, helpers.
- **The page:** one card per tool with name (mono), title, description, read-only badge, a parameter table (name, type, required, description) from `fieldsFromSchema`, a collapsible JSON Schema, and "Try" → `/try` + `encodeTryState({ tab: 'tools', tool })`.

- [ ] **Step 1: Write a failing test:** `buildToolCatalog()` has the same names as `MCP_TOOLS`; the first is `fetch_obs_study_manual`; every `inputSchema.type` is `'object'`.
- [ ] **Step 2: Run** it. Expected: FAIL. Then implement.
- [ ] **Step 3: Run** `npx vitest run tests/web/catalog.test.ts && npm run build:web`. Expected: PASS, and `web/dist/tools/index.html` contains all 12 tool names.
- [ ] **Step 4: Commit** "Generate the tools reference from the server registry".

### Task 8: Try page (guided session and tools)

**Files:**
- Create:
  - `web/src/routes/try/+page.svelte`
  - `web/src/lib/try/GuidedSession.svelte`, `ToolRunner.svelte`
  - `web/src/lib/try/presets.ts`
  - `web/src/lib/try/copyAs.ts`
  - `tests/web/copy-as.test.ts`

**Interfaces:**
- **Consumes:** `McpHttpClient` and `classifyOutcome` (Task 3), `fieldsFromSchema`, `argsFromValues`, `encodeTryState` and `decodeTryState` (Task 4), `ResultViewer`, `ToolForm` and `Markdown` (Task 5).
- **`PRESETS: { label: string; tool: string; args: Record<string, unknown>; needs?: string }[]`:**

  | Label | Tool | Args | `needs` |
  |---|---|---|---|
  | "Story 1, panels 5–8, questions only" | `fetch_obs_study_manual` | `{ reference: '1:5-8', part: 'movement1', include_answers: false }` | `include_answers` |
  | "Story 1, Movement 1" | `fetch_obs_study_manual` | `{ reference: '1', part: 'movement1' }` | |
  | "All stories" | `list_stories` | `{}` | |
  | "Languages" | `list_languages` | `{}` | |
  | "Search 'forgiveness'" | `search_content` | `{ query: 'forgiveness' }` (use the real parameter name from its schema) | |

  A preset whose `needs` parameter is missing from the live schema is hidden.
- **`curlFor(endpoint: string, tool: string, args: object): string`**: a single `curl -X POST` with both `Accept` types and a `tools/call` body.
- **`inspectorFor(endpoint: string, tool: string, args: object): string`**: `npx @modelcontextprotocol/inspector --cli <endpoint> --transport http --method tools/call --tool-name <tool>`, plus one `--tool-arg k=v` per argument.
- **Page:**
  - A header with the endpoint `CopyPill`, the connection state ("Connected", "Connecting…", or a banner on failure) and the rate-limit note.
  - Tabs "Guided session" and "Tools". The state is read from and written to the hash.
- **Guided session:**
  - language select from `list_languages`, story select from `list_stories`, and an optional panel range text field;
  - steps from the response's `sessionFlow`, with Back and Next;
  - each step calls `fetch_obs_study_manual { reference, part, language, format: 'md' }` and renders `structured.content`;
  - the Leader view / Community view switch is shown only when the live schema has `include_answers`; Community view adds `include_answers: false`.
- **Tools:** a tool list, then `ToolForm`, presets, `ResultViewer`, and "Copy as" curl or Inspector.

- [ ] **Step 1: Write a failing test** `tests/web/copy-as.test.ts`:
  - `curlFor('https://x/mcp', 'list_stories', {})` contains `-X POST`, `Accept: application/json, text/event-stream` and `"name":"list_stories"`;
  - `inspectorFor` with args `{ reference: '1:5' }` contains `--tool-arg reference=1:5`.
- [ ] **Step 2: Run** it. Expected: FAIL. Then implement `copyAs.ts` and `presets.ts`.
- [ ] **Step 3: Implement** the page and components.
- [ ] **Step 4: Manual check** against `npm run dev` (worker on :8790 after `npm run build:web`):
  - the preset "Story 1, Movement 1" shows `#### 01-01` rendered;
  - choosing `id` and a story with no data shows the not-available sentence;
  - a hand-edited hash `#abc` loads the guided tab without errors in the console.
- [ ] **Step 5: Run** `npx vitest run && npm run check --prefix web`. Expected: PASS, 0 errors.
- [ ] **Step 6: Commit** "Add the try page with a guided session and a tool runner".

### Task 9: Connect page

**Files:**
- Create: `web/src/routes/connect/+page.svelte`, `tests/web/connect.test.ts`
- Modify: `web/src/lib/connect/clients.ts` (created in Task 6), adding `CLIENTS`.

**Interfaces:**
- **`cursorDeeplink(endpoint: string): string`** → `cursor://anysphere.cursor-deeplink/mcp/install?name=obs-tf&config=<base64 of {"url":endpoint}>`
- **`vscodeDeeplink(endpoint: string): string`** → `https://vscode.dev/redirect/mcp/install?name=obs-tf&config=<encodeURIComponent of {"type":"http","url":endpoint}>`
- **`CLIENTS(endpoint): { id; label; steps: string; tabs: { label; code }[]; installHref?: string }[]`**, for: Claude Code, Claude Desktop and claude.ai, Cursor, VS Code, Codex, BT Servant, Other.
  - Claude Code: `claude mcp add --transport http obs-tf <endpoint>`.
  - BT Servant: "Configured by unfoldingWord admins in the BT Servant admin portal", with no snippet.
  - Other: the bare URL plus `npx -y mcp-remote <endpoint>` for clients that only run local servers.
  - Before writing each snippet, check it against the client's current docs. Note in the PR description any client whose format you could not confirm.
- **Troubleshooting section:**
  - Streamable HTTP only;
  - the `Accept` header;
  - `url` vs `serverUrl` keys being ignored silently;
  - rate limit;
  - `available: false` answers.

- [ ] **Step 1: Write a failing test:** `cursorDeeplink('https://x/mcp')` decodes back to `{ url: 'https://x/mcp' }`; `vscodeDeeplink` contains `vscode.dev/redirect/mcp/install`; `CLIENTS('https://x/mcp')` has 7 entries, and every code snippet contains `https://x/mcp`.
- [ ] **Step 2: Run** it. Expected: FAIL. Then implement.
- [ ] **Step 3: Implement** the page with `CodeTabs`.
- [ ] **Step 4: Run** `npx vitest run tests/web/connect.test.ts && npm run check --prefix web`. Expected: PASS.
- [ ] **Step 5: Commit** "Add the connect page".

### Task 10: Docs pages and llms.txt links

**Files:**
- Create:
  - `web/src/routes/docs/+layout.svelte` (sidebar)
  - `web/src/routes/docs/+page.svelte` (overview)
  - `web/src/routes/docs/` subfolders, each with a `+page.svelte`: `sessions/`, `references/`, `questions-only/`, `sources/`, `limits/`, `faq/`

**Content rules:** every fact is taken from code, with the source file named in a comment at the top of each page.

| Page | What it covers | Source |
|---|---|---|
| sessions | `sessionFlow`, `part` values and `movement` | `src/content/studyManual.ts` |
| references | `story`, `story:frame`, `story:first-last`, and `1:0` | `src/content/obsTfReference.ts` |
| questions-only | `include_answers` and `section` | PR #18. Until it merges, a note: "Available once unfoldingWord/obs-5m-mcp#18 is released" |
| sources | Door43 catalog subject and topic, Indonesian fallback | `src/content/contentService.ts`, `src/mcp/instructions.ts` |
| limits | `RATE_LIMIT_RPM` default 90, response sizes, tip to use `part` and ranges | `src/core/rateLimit.ts` |
| faq | short answers about what the server does and does not do | the pages above |

The FAQ answers these questions:
- Is it free?
- Does it need a key?
- Does it change content?
- Which languages?
- Is Part One served? (No.)
- How does BT Servant use it?

- [ ] **Step 1: Write** the pages.
- [ ] **Step 2: Run** `npm run check --prefix web && npm run build:web`. Expected: 0 errors, and `web/dist/docs/sessions/index.html` exists.
- [ ] **Step 3: Check** that `buildLlmsTxt` (Task 1) links `/docs`, `/tools`, `/connect` and `/try`. Update its test if a link was added.
- [ ] **Step 4: Commit** "Add the docs pages".

### Task 11: Smoke test, previews config, CI and README

**Files:**
- Create: `tests/e2e/site.spec.ts`, `playwright.config.ts`
- Modify:
  - `package.json`: add `@playwright/test` as a dev dependency, a `test:e2e` script, and `check:web` (`npm run check --prefix web`).
  - `.github/workflows/ci.yml`: after the existing steps, add `npm ci --prefix web`, `npm run check:web` and `npm run build:web`.
  - `wrangler.toml`: add a `previews` block with its own `OBS_5M_CACHE` KV namespace id. If you cannot create the namespace, put a placeholder id with an `# ASK:` comment, and list it in the PR description as the account-holder step.
  - `README.md`: rewrite from scratch:
    - what it is (one paragraph, linking the site);
    - endpoint;
    - local development (`npm run build:web`, `npm run dev`, then open `/try`);
    - tests;
    - deploy;
    - previews (which option, and how to find a PR's URL);
    - license.
    - No mention of chat or OpenAI.

**Smoke test,** run with Playwright against `npm run dev` (`webServer` in `playwright.config.ts`, port 8790):
- `/` shows "Open Bible Stories + Theological Formation".
- `/try`, after clicking the "Story 1, Movement 1" preset, shows text `01-01` within 15 s.
- `/tools` lists `fetch_obs_study_manual`.
- `/chat` lands on `/try`.
- At viewport 375×800, `document.documentElement.scrollWidth <= 375` on `/`, `/try`, `/connect`, `/tools` and `/docs`.

- [ ] **Step 1: Write** `tests/e2e/site.spec.ts` and the config.
- [ ] **Step 2: Run** `npm run build:web && npx playwright install chromium && npm run test:e2e`. Expected: all pass. Fix the site, not the test, on failures.
- [ ] **Step 3: Run** the full gate: `npm run typecheck && npm test && npm run check:web && npm run build:web`. Expected: all green.
- [ ] **Step 4: Commit** "Add the site smoke test, preview config and new README".
- [ ] **Step 5: Hand-off:** show Abel screenshots of `/`, `/try` and `/connect` in both themes, and the draft PR text. Do not push until he says so.

## After this plan (spec §Delivery, each step needs Abel's OK)

1. Push `feat/site-redesign` and open its PR. Ask the Cloudflare account holder to turn on Worker Previews.
2. Merge the site PR into `master`.
3. Merge `master` into `fix/17-study-manual-frames` (PR #18). The `include_answers` preset and the Leader view / Community view switch appear by themselves.
4. Post the PR #18 test instructions with `/try` links built by `encodeTryState`, and request review.
