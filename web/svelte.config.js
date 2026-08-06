import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** Root-mounted on the obs-5m Worker (no /v2 prefix). */
const BASE_PATH = process.env.BASE_PATH === undefined ? '' : process.env.BASE_PATH.replace(/\/$/, '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Disable platformProxy during `vite build` — workerd locks
			// `.svelte-kit/cloudflare` on Windows and breaks adapter rimraf (EBUSY).
			// Local `vite dev` still works without it; use `wrangler dev` for bindings.
			platformProxy: {
				enabled: false
			}
		}),
		paths: {
			base: BASE_PATH,
			relative: false
		},
		alias: {
			$lib: './src/lib',
			$chat: '../src/chat',
			$mcp: '../src/mcp',
			$core: '../src/core',
			$content: '../src/content'
		}
	}
};

export default config;
