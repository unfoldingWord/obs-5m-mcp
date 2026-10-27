# OBS-TF MCP

A read-only [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI assistants the **Open Bible Stories + Theological Formation** study manual (OBS-TF, also called 5M OBS after its Five Movements): fifty stories, each with an introduction, the story panels, a community study, the Five Movements and a conclusion. Content comes from the Door43 catalog. No key or sign-up is needed.

- Site: <https://obs-5m-mcp.unfoldingword.workers.dev> (explains the content, lets you try every tool, and shows how to connect clients)
- MCP endpoint (Streamable HTTP): `https://obs-5m-mcp.unfoldingword.workers.dev/mcp`
- Theological Formation: [formationstories.org](https://formationstories.org/)
- Content: [en_obs-tf](https://git.door43.org/unfoldingWord/en_obs-tf) and [id_obs-tf](https://git.door43.org/unfoldingWord/id_obs-tf) on Door43, CC BY-SA 4.0

## Routes

| Path | What it is |
|---|---|
| `/mcp` | The MCP server (Streamable HTTP) |
| `/api/tool` | Direct tool call (POST `{ "tool", "arguments" }`); `"debug": true` adds X-ray traces |
| `/api/mcp-manifest` | Tool catalog as JSON |
| `/api` | JSON discovery (also `/` with `Accept: application/json`) |
| `/llms.txt` | Plain-text summary for agents |
| `/health` | Liveness |
| `/assets/pdf/<r2Key>` | Indonesian PDF download from R2 |
| everything else | The website, built from `web/` into `web/dist` |

`/chat` and `/debug` redirect to `/try`.

## Local development

```bash
npm install
npm install --prefix web
npm run build:web        # builds the site into web/dist
npm run dev              # Worker and site on http://localhost:8790
```

Open <http://localhost:8790/try> to call the local server from the browser. For live reload of the site, run `npm run dev:web` (Vite on :8174, proxying `/mcp` and `/api` to the Worker on :8790).

`npm run build:web` first refreshes `web/src/lib/anatomy/snapshot.json` (the saved story 1 excerpts shown when the home page cannot reach the server) from Door43, and keeps the existing file when Door43 is unreachable.

## Tests

```bash
npm run typecheck
npm test                 # Worker, content and site logic (Vitest)
npm run check:web        # Svelte type check
npm run build:web && npm run test:e2e   # browser smoke test (Playwright; starts wrangler dev)
npm run test:smoke       # against a running server
```

Install the Playwright browser once with `npx playwright install chromium`.

## The site

`web/` is a SvelteKit app with static output. Pages are prerendered; the try page and the story anatomy call the server's own `/mcp` from the browser with a small client (`web/src/lib/mcp/client.ts`). The tool reference (`/tools`) is generated at build time from the server's tool registry, so it always matches the server.

## Previews

`wrangler.toml` has a `previews` block for [Cloudflare Worker Previews](https://developers.cloudflare.com/workers/previews/): one isolated copy of the Worker per branch or pull request, with its own Durable Object storage and the preview KV namespace for the cache. To turn previews on, someone with access to the unfoldingWord Cloudflare account must:

1. Update Wrangler to 4.135.0 or later. That needs `@cloudflare/workers-types` v5, which first needs a compatible version of `agents` (its `partyserver` dependency still asks for v4).
2. Connect this repository to Workers Builds, which creates a preview for every pull request. Or add `CLOUDFLARE_API_TOKEN` and the account id as GitHub secrets and run `npx wrangler preview` in a workflow.

## Deploy

```bash
npm run deploy           # builds the site, then wrangler deploy
```

The GitHub deploy workflow needs the `CLOUDFLARE_API_TOKEN` secret (see issue #5).

### Cloudflare setup

```bash
npx wrangler kv namespace create OBS_5M_CACHE
npx wrangler kv namespace create OBS_5M_CACHE --preview
# Optional, for Indonesian PDF hosting (enable R2 in the dashboard first):
npx wrangler r2 bucket create obs-5m-mcp-assets
```

Put the KV ids in `wrangler.toml` and set `PUBLIC_BASE_URL`. `RATE_LIMIT_RPM` (default 90 per address, `0` turns it off) and `MCP_API_KEY` (a secret; unset means public) are optional.

## BT Servant

1. Register `https://<worker>/mcp` in the BT Servant admin portal.
2. Responses carry `_meta.downstream_api_calls`, `_meta.cache_status` and `_meta.response_size_bytes`, as the [MCP integration guidelines](https://github.com/unfoldingWord/bt-servant-worker/blob/main/docs/mcp-integration-guidelines.md) ask.
3. Smoke check: `list_resources` for `en` and `id`, and `fetch_obs_study_manual` with `reference: "1:1"`, `language: "en"`.

## Indonesian content pipeline

The server serves Indonesian from Door43 (`id_obs-tf`) and falls back to converted markdown shipped in `data/obs-tf-md/id/` when Door43 has no entry for a story.

```bash
npm run plain-md -- --story=1          # PDF → plain markdown
npm run convert:id -- --story=1        # plain markdown → en_obs-tf shape
npm run convert:id:from-pdf            # generate missing plain markdown, then convert all
npm run export:dcs                     # build a Door43 repo tree in exports/id_obs_tf/
npm run ingest:id                      # upload PDFs and text to R2
```

Unpack the source PDFs into `data/incoming/` first (names like `OBS 1 (Indonesia).pdf`). Structure cues live in `data/structure-maps/id.json`.

## Architecture

A Cloudflare Worker with an `McpAgent` Durable Object for `/mcp`, Zod-typed tools (`src/mcp/tools/`), content loading and parsing in `src/content/`, and the static site in `web/`. Missing content answers `available: false` with `RESOURCE_NOT_AVAILABLE` and `isError: false`; Door43 outages answer `UPSTREAM_DCS_ERROR`.
