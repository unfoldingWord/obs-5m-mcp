import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** Root-mounted on the obs-5m Worker (no /v2 prefix). */
const BASE_PATH = process.env.BASE_PATH === undefined ? '' : process.env.BASE_PATH.replace(/\/$/, '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Static assets only. The Worker owns /api/chat, /mcp, /docs, /.
		// Avoids adapter-cloudflare rimraf EBUSY on Windows.
		adapter: adapter({
			// `build/` is often locked by wrangler --port 8790 on Windows.
			pages: 'dist',
			assets: 'dist',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		prerender: {
			// Worker-owned routes (/docs, /mcp, /debug, /) are not Svelte pages.
			handleHttpError: 'warn'
		},
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
