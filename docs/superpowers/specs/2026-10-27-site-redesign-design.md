# OBS-TF MCP site redesign

Date: 2026-10-27
Branch: `feat/site-redesign` (from `master`)
Status: draft for review

## Why

The current site at `https://obs-5m-mcp.unfoldingword.workers.dev` misdescribes the product, its audience, and how it fits with BT Servant. It also offers no easy way for a person to see what the server returns. Testers of PRs such as #18 have nowhere to run the tools without a local checkout.

This is a clean slate. No text, styles, or components from the current site are reused. Every statement on the new site comes from the product itself:
- what the server exposes (`tools/list`, tool schemas, server instructions);
- what it returns;
- the published resource on Door43.

## Goals

1. Explain what the server offers, and what OBS + Theological Formation is, to two audiences:
   - **partners and facilitators**, who want to understand the content;
   - **integrators and the team**, who connect clients and test changes.
2. Let anyone try the server in the browser with no key, no sign-up and no AI model.
3. Make connecting a client a copy or a click.
4. Keep the docs from drifting: tool reference and forms are generated from the server's own registry and schemas.
5. Give every PR its own preview URL so reviewers can test there.

## Non-goals

- No AI chat. The current `/chat` page, `/api/chat`, and the OpenAI dependency are removed.
- No accounts, auth, or analytics.
- English only for now.
- No change to tool behavior. PR #18 lands separately.

## Naming

- **Server:** "OBS-TF MCP". The technical id (`obs-5m-mcp`) and the URL stay as they are. The site says once: "also called 5M OBS, after its Five Movements".
- **Content:** "Open Bible Stories + Theological Formation" (OBS-TF). This is the Door43 title, *unfoldingWord® Open Bible Stories + Theological Formation*.
- **Five Movements:** the structure inside every story, not a separate product.
- The display name is defined in one constant, so a later rename is a single edit.

## Facts the content rests on (verified 2026-10-27)

- **Door43 repos:**
  - [unfoldingWord/en_obs-tf](https://git.door43.org/unfoldingWord/en_obs-tf), English, catalog subject "OBS Theological Formation";
  - [unfoldingWord/id_obs-tf](https://git.door43.org/unfoldingWord/id_obs-tf), Indonesian.
  - Both are published to the Door43 catalog (prod).
- **Manifest:**
  - "Open Bible Stories with the five-fold movements of the Equipping Journey added";
  - 50 stories, Creation to Revelation;
  - based on OBS v9;
  - CC BY-SA 4.0, publisher unfoldingWord, checking level 3.
- **Theological Formation's public home:** [Formation Stories](https://formationstories.org/) ("Theological Formation for the Global Church").
  - It describes TF as fifty stories drawn from Open Bible Stories, each moving through the Five Movements.
  - Part One is a **Formation Plan**: three conversations (Mission, Church, Formation) plus a summary.
  - The 50 stories are grouped into 11 units, each with a one-line description.
  - It links to [Open Bible Stories](https://www.openbiblestories.org/) and [Strategic Mission Collective](https://strategicmissioncollective.org/), and offers story PDFs and a Formation Guide.
- **The edition this server serves** is the Door43 `en_obs-tf` resource, whose own [overview](https://git.door43.org/unfoldingWord/en_obs-tf/src/branch/master/transclusions/overview.md) matches Formation Stories with two differences:
  - its Part One is the **Mission-Translation Brief**, which adds a fourth conversation on translation;
  - the translation steps (draft, team check, community check, sociolinguistic check) are woven into Movements 2–5.
  - The site says this plainly: same stories and Five Movements, in the edition that adds translation training.
- **People, in the material's own words:** there are no instructor and student roles.
  - It addresses **your community** (the church, its disciples) working through each story together.
  - It addresses the **leaders** who guide the process and "train and multiply trainers".
  - The Door43 edition also names the **translation team**.
  - The site uses these words, not invented ones.
- **Other links:** [Door43](https://door43.org) and [unfoldingWord content](https://unfoldingword.org/for-translators/content/). The Equipping Journey is named in the Door43 manifest, but has no page of its own, so it is not linked.
- **Not served today:** Part One, the Mission-Translation Brief or Formation Plan. The site states that the server covers the 50 stories, their 11 units and the Five Movements.
- **Story anatomy,** from `en_obs-tf` story 1 and its shared sections:
  1. Introduction: key idea, creedal verse, metanarrative summary.
  2. The story: 16 panels with images and the Bible source. Panels are ids such as `01-05`.
  3. Community study: a devotional shared by the stories of a unit.
  4. Movement 1, Biblical interpretation: observation questions with answers per panel, and translation questions (key terms) per panel.
  5. Movement 2, Theological dialogue: discourse questions over panel ranges, theological questions, and the translation draft.
  6. Movement 3, Personal reflection: journal reflection and the team check.
  7. Movement 4, Ministry practice: church ministry and the church community check.
  8. Movement 5, Missional outreach: mission engagement and the sociolinguistic check.
  9. Conclusion.
- **The translation workflow** (draft → team check → community check → sociolinguistic check) is woven through Movements 2–5. Each item maps to a `part` value of `fetch_obs_study_manual`.
- **Implementation check:** any statement about tools, parameters, limits or sources is checked against the code, not copied from the old site.

## Visual system

A hybrid of the Sentry MCP and Exa docs layouts, in manuscript colors.

**Type**
- Geist for text and headings; Geist Mono for URLs, code and tool names.
- Two weights (400, 500), short headings, sentence case.

**Dark theme (default)**

| Token | Value |
|---|---|
| Background | `#121815` |
| Raised surface | `#18201C` |
| Border | `#2A332E` / `#3A463F` |
| Text | `#EDE6D6` |
| Secondary text | `#A9B3A9` |
| Accent (ochre, primary action) | `#C9A35C` |
| Accent 2 (sage, metadata) | `#7FA38E` |

**Light theme**

| Token | Value |
|---|---|
| Background (paper) | `#F6F1E7` |
| Raised surface | `#FFFDF8` |
| Border | `#E2D9C6` |
| Text | `#1E2B25` |
| Secondary text | `#4A5A52` |
| Accent (ink green) | `#2F5D50` |
| Ochre labels | `#8A6A33` |

**Theme switching**
- Follows the system setting, with a manual toggle.
- All colors are CSS tokens on `:root`, overridden for the theme.

**Layout**
- Marketing pages: a narrow column (max ~720px text) and a minimal top bar (name, read-only badge, GitHub, "Try it").
- Docs pages: a left sidebar, as on Exa.
- `/try` is a full-width workbench.
- Works at phone width with no horizontal scroll.

**Components (new):**
- Button: primary and secondary.
- URL copy pill.
- Client tabs with code blocks and copy.
- Tool card.
- Parameter form fields, built from JSON Schema types: enum → select, boolean → switch, integer with bounds → number, string → text.
- Result viewer: rendered, JSON and JSON-RPC tabs, with size and time.
- Story picker: language, story, part.
- Anatomy explorer.
- Callout, for notes and warnings.

## Site map

| Path | Audience | Content |
|---|---|---|
| `/` | Both | Hero, what the server offers, what OBS-TF is, anatomy of a story, what you can ask, who uses it, connect teaser |
| `/try` | Both | Workbench: guided session tab and tools tab |
| `/connect` | Integrators | Per-client setup, one-click installs, troubleshooting |
| `/tools` | Integrators | Generated reference for every tool |
| `/docs` | Integrators | Guide: sessions and parts, references and ranges, sources and languages, limits and sizes, FAQ |
| `/llms.txt` | Agents | Plain-text summary with endpoint, tools and links |

**Kept unchanged:** `/mcp`, `/api/tool`, `/api/mcp-manifest`, `/health`, `/assets/pdf/*`.

**Redirects (301):**
- `/chat` → `/try`
- `/debug` → `/try?tab=tools`
- `/docs/` keeps working.

### Home (`/`)

1. **Hero:**
   - one sentence on what it does;
   - the `/mcp` URL with copy;
   - "Install in Cursor";
   - "Try it";
   - the line "No key, no sign-up, read-only".
2. **What the server offers:** structured, quotable OBS-TF content for AI assistants:
   - whole sessions or one part at a time;
   - single panels or panel ranges;
   - questions with or without answers;
   - English from Door43 and Indonesian;
   - every request returns the manual's own words.
3. **What OBS + Theological Formation is:** the facts above, in the material's own words. It links first to Formation Stories (the public home of TF), then to Open Bible Stories, Door43, the two repos and unfoldingWord. It explains in one short paragraph that this server serves the Door43 edition, with translation training. A line on the license and attribution.
4. **Anatomy of a story:**
   - an interactive explorer of the nine parts listed above;
   - each part shows what it contains, a real excerpt, a plain-language request a person might make, and the matching tool call;
   - "Open in Try" runs that exact call;
   - the excerpt comes live from `/mcp` (story 1, English), with a build-time snapshot as fallback when the call fails.
5. **What you can ask:** 4–6 example requests. Each shows the tool call it leads to and opens in `/try`.
6. **Who uses it:** BT Servant (unfoldingWord), with one line on how it uses the server. Other MCP clients work too.
7. **Connect teaser:** client logos or names linking to `/connect`.
8. **Footer:** GitHub repo, Door43 sources, license, `llms.txt`, manifest, health, version.

### Try (`/try`)

The shared header shows the endpoint in use (same-origin `/mcp`), the connection state, and the rate-limit note.

**Guided session tab** (facilitators):
- Pick a language (from `list_languages`), a story (from `list_stories`), and optionally a panel range.
- Step through `sessionFlow` parts with next and previous buttons.
- Each step calls `fetch_obs_study_manual` and shows the rendered markdown.
- A switch with two named views, in the material's own vocabulary:
  - **Leader view:** with the manual's answers, to prepare and guide.
  - **Community view:** questions only, what the group works through.
  - Underneath, the switch sets `include_answers`. Until PR #18 is merged, it is hidden when the server's schema does not have that parameter.

**Tools tab** (integrators):
- A tool list on the left.
- A form generated from the tool's input schema.
- Preset chips that fill and run the form, for example "Story 1 panels 5–8, questions only" and "Search 'forgiveness'".
- The result viewer with Rendered, JSON and JSON-RPC tabs, plus size in bytes and time in ms.

**Both tabs:**
- "Copy as": a curl JSON-RPC command, or an MCP Inspector CLI command.
- The URL hash encodes the tab, tool and arguments, so a result can be shared as a link.
- Test instructions for PRs use these links.

### Connect (`/connect`)

- **Tabs:** Claude Code (CLI), Claude Desktop and claude.ai (custom connector), Cursor (deeplink plus JSON), VS Code (deeplink plus JSON), Codex, Other (URL plus `mcp-remote` for clients that only run local servers), and BT Servant (configured by unfoldingWord admins).
- **Troubleshooting:**
  - Streamable HTTP only;
  - the `Accept` header;
  - `url` vs `serverUrl` keys being silently ignored;
  - rate limit;
  - "not available" answers for languages without content.
- Every snippet's format is checked against that client's current docs at implementation time.

### Tools (`/tools`)

- One card per tool, generated at build time from the server's tool registry: name, description, read-only badge, parameter table, collapsible JSON Schema, and "Try" (opens `/try` with the tool loaded).
- Order: `fetch_obs_study_manual` first, then discovery, then helpers.

### Docs (`/docs`)

Pages:
- Overview
- Sessions and parts (`sessionFlow`, `part`, `movement`)
- References and ranges
- Questions only
- Sources and languages (Door43 catalog, Indonesian)
- Limits and sizes (rate limit, response sizes, tips for staying under client caps)
- FAQ

The text is written from the code and the server instructions.

## Architecture

### Web app (`web/`)

- Rebuilt from scratch. Kept: SvelteKit with `adapter-static` (prerendered pages) and Tailwind v4 as a utility layer under the new tokens.
- Deleted: all current components, stores, routes and CSS in `web/src`.
- **Build-time data:** pages import the server's tool registry (`$mcp`) and convert input schemas with `zod-to-json-schema` (already a dependency). The anatomy fallback snapshot is generated from the test fixture for story 1.
- **Run-time data:**
  - The browser uses the official MCP TypeScript SDK client with the Streamable HTTP transport against same-origin `/mcp`.
  - One client per page load: `initialize`, `tools/list`, then calls.
  - A thin wrapper records each JSON-RPC request and response for the JSON-RPC tab, and measures size and time.
- **Markdown rendering:** `marked` plus a sanitizer, with output limited to safe tags.

### Worker (`src/`)

**Routes**
- Kept: `/mcp`, `/api/tool`, `/api/mcp-manifest`, `/health`, `/assets/pdf/*`.
- New: `/llms.txt`, built from the registry.
- Redirects: `/chat` and `/debug`.
- Everything else is served from `ASSETS`.

**Deleted**
- `src/chat/`, `src/docs/`, and `src/core/xray/debugPage.ts`.
- The `/api/chat` route.
- `OPENAI_API_KEY` from docs and `.env.example`.
- X-ray tracing used only by those pages. It stays if `/api/tool` `debug:true` still uses it.

**Tests and docs**
- Tests referring to the deleted pages are removed or rewritten.
- `README.md` is rewritten to match the new site.

### Errors

- `available: false` answers show as a plain message ("Story 3 has no Indonesian content yet").
- Upstream Door43 errors show "Couldn't reach Door43. Retry" with a retry button.
- Rate-limit (429) responses show the wait.
- A failed `initialize` shows a banner. The rest of the site still works.

## PR previews

- **Mechanism:** Cloudflare Worker Previews ([changelog, 2026-09-22](https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/)). They support Durable Objects, which `/mcp` uses, by isolating them per preview.
- **Repo changes:** a `previews` block in `wrangler.toml`, with its own KV namespace for the cache, so previews never write to the production cache.
- **Manual step** by someone with access to the unfoldingWord Cloudflare account. Either:
  - connect the repo to Workers Builds, which posts the preview URL on each PR; or
  - add `CLOUDFLARE_API_TOKEN` and the account id as GitHub secrets (the same need as #5) and run `wrangler preview` from a workflow.
- `README.md` documents which option is used and how to find a PR's URL.

## Testing

- **Worker (Vitest):**
  - routes kept;
  - redirects;
  - `/llms.txt` content;
  - deleted routes return 404 or redirect.
- **Web:**
  - `svelte-check`;
  - unit tests for the schema-to-form mapping, the hash encoding and decoding, and the JSON-RPC recorder.
- **Browser smoke test (Playwright) against `wrangler dev`:**
  - open `/`;
  - open `/try`;
  - run the preset "Story 1 panels 5–8, questions only" and see four panel headings;
  - open `/tools` and see every registered tool;
  - check phone width has no horizontal scroll.
- **CI:** existing typecheck and tests, plus `web` check and build.

## Delivery

1. Build the site on `feat/site-redesign` and open its PR.
2. Ask the Cloudflare account holder to turn on previews, so the site PR gets a preview URL. Until then, review runs locally with `npm run dev`.
3. Merge the site PR to `master`.
4. Merge `master` into `fix/17-study-manual-frames` (PR #18). Its preview then shows `include_answers` and `section` in `/try`, because the forms come from the schema.
5. Post test instructions on PR #18, with `/try` links that load each check from issue #17, and request review.

## Open items

- Who turns on Worker Previews in the unfoldingWord Cloudflare account. This also unblocks #5.
- Part One (Mission-Translation Brief / Formation Plan) is not served by the server. Adding it is a separate issue, not part of this site work.
- Whether to add Spanish or Indonesian later. The text is kept in one place per page to make that easy.
