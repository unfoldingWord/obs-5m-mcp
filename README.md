# obs-5m-mcp

MCP server for **Open Bible Stories + Theological Formation** (Five Movements).

Content resolution: DCS catalog **`subject=OBS Theological Formation`** + **`topic=tc-ready`** (same defaults as Translation Helps MCP). English comes from Door43 [`unfoldingWord/en_obs_tf`](https://git.door43.org/unfoldingWord/en_obs_tf). When DCS has no entry (Indonesian today), tools use **extracted text from self-hosted PDFs** (R2) — not just a download link ([bt-servant-engine#215](https://github.com/unfoldingWord/bt-servant-engine/issues/215)).

Implements the study-manual surface requested in [translation-helps-mcp#36](https://github.com/unfoldingWord/translation-helps-mcp/issues/36) via **`fetch_obs_study_manual`**.

Content license: **CC BY-SA 4.0** (unfoldingWord / partners).

## Quick start

```bash
npm install
npm test                 # unit + contracts
npm run test:unit
npm run test:contracts
npm run dev              # http://localhost:8790
# Chat UI (needs OPENAI_API_KEY in .dev.vars):
#   http://localhost:8790/chat
# with wrangler running:
npm run test:smoke
```

Copy `.dev.vars.example` → `.dev.vars` and set `OPENAI_API_KEY` for the chat UI. Deployed: `wrangler secret put OPENAI_API_KEY`.

Endpoints:

| Path | Purpose |
|------|---------|
| `/` | Website home |
| `/docs` | **Agent guide** — how AI agents run translator sessions with these tools |
| `/chat` | Simple LLM chat UI (OpenAI + in-process MCP tools) |
| `/api/chat` | Chat SSE API (`status` / `token` / `done`; `"debug": true` for X-ray) |
| `/mcp` | MCP (Streamable HTTP / SSE via `agents/mcp`) |
| `/api` | JSON discovery (`Accept: application/json` on `/` also works) |
| `/api/mcp-manifest` | Tool catalog JSON |
| `/api/tool` | Direct tool invoke; pass `"debug": true` for X-ray traces |
| `/debug` | X-ray UI (tool runner + pipeline report) |
| `/assets/pdf/<r2Key>` | Stream self-hosted PDF from R2 |
| `/health` | Liveness |

### Tests & X-ray

Modeled on [translation-helps-mcp](https://github.com/unfoldingWord/translation-helps-mcp):

| Suite | Command | What it covers |
|-------|---------|----------------|
| Unit | `npm run test:unit` | Parser, study manual, handlers (mocked Door43), X-ray events |
| Contracts | `npm run test:contracts` | Tool module shape + `outputSchema` / `RESOURCE_NOT_AVAILABLE` |
| Smoke | `npm run test:smoke` | Live `/health`, manifest, `fetch_obs_study_manual` + X-ray |

**X-ray** (pipeline transparency): POST `/api/tool` with `"debug": true` returns `{ result, xray, xrayReport }`. Open `/debug` for an interactive panel. Chat also supports X-ray via the checkbox on `/chat` (or `"debug": true` on `/api/chat`).

### Chat (LLM + MCP tools)

Cloned from Translation Helps `/chat` (SvelteKit + ChatDock + X-ray), rewired for OBS study-for-translation instead of scripture/TN/TW.

```bash
# Terminal A — MCP worker (tools, PDFs, docs)
npm run dev

# Terminal B — Svelte chat (primary UI)
npm run dev:web
# → http://localhost:8174/chat
```

- **Study / Translate / Check** map onto OBS sessionFlow parts (not Bible workflow modes).
- **Session** side panel replaces the TH Helps/scripture panel with Five Movements parts.
- API: `web/src/routes/api/chat` → `src/chat/chatHandler` + in-process `TOOL_REGISTRY` (OBS tools).
- Worker `:8790/chat` still serves a slim HTML fallback if the Svelte app is not running.

## Tools

Discovery: `list_languages`, `list_resources`, `list_collections`, `list_stories`  
**Study manual (#36):** `fetch_obs_study_manual`  
Helpers: `get_framework`, `get_story`, `get_movement`, `get_devotional`, `get_study_guide`, `search_content`  
PDFs: `get_pdf` (Indonesian pack)

### `fetch_obs_study_manual` (preferred for BT Servant)

```json
{
  "tool": "fetch_obs_study_manual",
  "arguments": {
    "reference": "1:1",
    "language": "en",
    "movement": 1,
    "format": "json"
  }
}
```

| Param | Description |
|-------|-------------|
| `reference` | OBS `story:frame` — `"1:1"`, `"1"` (whole story), `"1:0"` (intro). Optional `obs ` prefix. |
| `language` | Default `en` (Door43 `en_obs_tf`). |
| `part` | Optional session slice: `intro` \| `frames` \| `community` \| `movement1`–`5` \| `drafting` \| `checking` \| `conclusion`. Preferred for paced translator sessions. |
| `movement` | Optional `1`–`5` (same as `part=movementN`). Prefer `part` for drafting/checking/conclusion. |
| `format` | `json` (default), `md`, or `text` — md/text always render from the same parsed data (never falsely empty). |

Returns intro, frames, Community Study, Observation / Translation / Discourse / Theological / Journal, **drafting**, **checking**, Ministry / Mission, and **conclusion** — packaging resolved (shared TX and story-inline look the same). Response includes `sections` and `sessionFlow` for agent routing.

### Related Translation Helps issues (out of scope here)

| Issue | Topic | Where it lives |
|-------|--------|----------------|
| [#36](https://github.com/unfoldingWord/translation-helps-mcp/issues/36) | `en_obs_tf` study manual | **This server** (`fetch_obs_study_manual`) |
| [#34](https://github.com/unfoldingWord/translation-helps-mcp/issues/34) | OBS tn/tq/sn/sq `format:md` empty | Translation Helps MCP (classic OBS TSV tools) |
| [#35](https://github.com/unfoldingWord/translation-helps-mcp/issues/35) | OBS translation-word links (`en_obs-twl`) | Translation Helps MCP |

## Indonesian PDFs → OBS-TF markdown (DCS fallback)

Used only when catalog search finds no OBS Theological Formation for `id`.

**Canonical pipeline:** PDF → font-aware plain MD → DCS-shaped MD (do not convert from coarse txt when plain MD is available).

```bash
# 1) PDF → plain MD (headings, **NN-NN** frames)
npm run plain-md -- --story=1
# 2) plain MD → en_obs_tf-shaped MD + transclusions
npm run convert:id -- --story=1
# Or generate missing plain MD then convert all:
npm run convert:id:from-pdf
# Force re-extract plain MD from PDF, then convert:
npm run convert:id -- --regen-plain --story=1
```

Setup steps:

1. Download the zip from [bt-servant-engine#215](https://github.com/unfoldingWord/bt-servant-engine/issues/215) (or Google Drive).
2. Unpack PDFs into `data/incoming/` (names like `OBS 1 (Indonesia).pdf`).
3. Optional txt fallback: `npm run ingest:id -- --text-only` → `data/indonesian-text.json`
4. Run the canonical pipeline above → `data/obs-tf-md/id/obs_story_N.md` with unique sections (community study, divergent movements) inlined, shared movement/conclusion as `![[…]]` transclusions, plus `structure-report.json` (soft metrics: translation terms, skeleton flags, shared-tx drift).
5. `--offline` uses the story-1 fixture for DCS compare when network is unavailable.
6. Upload PDF + text to R2: `npm run ingest:id` or `--local` for wrangler dev.

Structure cues live in [`data/structure-maps/id.json`](data/structure-maps/id.json). Runtime prefers converted MD (`sourceKind: local-md`) over coarse PDF text. `get_pdf` still returns the file URL and extracted text.

### Export a Door43 repo tree

After convert, build an upload-ready Resource Container folder (manifest + stories + transclusions):

```bash
npm run export:dcs
# or regenerate convert first:
npm run export:dcs -- --convert
# custom output:
npm run export:dcs -- --out=./tmp/id_obs_tf --force
```

Output: `exports/id_obs_tf/` (gitignored). Create an empty Door43 repo, then `git init` / push from that folder — see `exports/id_obs_tf/README.md`.

## Cloudflare setup

This app deploys as a **Cloudflare Worker** (MCP Durable Object + Workers Assets for the Ezer chat UI). That is the right host for MCP — not a static Pages site alone.

```bash
npx wrangler kv namespace create OBS_5M_CACHE
npx wrangler kv namespace create OBS_5M_CACHE --preview
# Optional (Indonesian PDF hosting) — enable R2 in the dashboard first:
npx wrangler r2 bucket create obs-5m-mcp-assets
```

Paste the KV ids into `wrangler.toml`, set `PUBLIC_BASE_URL`, then:

```bash
npm run deploy
npx wrangler secret put OPENAI_API_KEY
```

Chat: `https://<worker>/chat` · MCP: `https://<worker>/mcp`

## BT Servant registration

1. Deploy this worker.
2. Register the MCP URL (`https://<worker>/mcp`) in BT Servant admin (see `bt-servant-worker` curl examples).
3. Responses include `_meta.downstream_api_calls` and `_meta.cache_status` per [MCP integration guidelines](https://github.com/unfoldingWord/bt-servant-worker/blob/main/docs/mcp-integration-guidelines.md).
4. Smoke: `fetch_obs_study_manual` with `reference: "1:1"`, `language: "en"`; `list_resources` for `id` + `get_pdf`.

## Architecture

Modeled on [translation-helps-mcp](https://github.com/unfoldingWord/translation-helps-mcp) v2: Cloudflare Worker + `McpAgent` Durable Object, Zod tools, `RESOURCE_NOT_AVAILABLE` with `isError: false`.
