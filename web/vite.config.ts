import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ssrSafeDompurify(): Plugin {
	const stub = path.resolve(__dirname, 'src/lib/dompurify-ssr-stub.ts');
	return {
		name: 'ssr-safe-dompurify',
		enforce: 'pre',
		resolveId(id, _importer, opts) {
			if (opts?.ssr && (id === 'isomorphic-dompurify' || id === 'dompurify')) {
				return stub;
			}
		}
	};
}

export default defineConfig({
	plugins: [ssrSafeDompurify(), tailwindcss(), sveltekit()],
	ssr: {
		external: ['zod', 'zod-to-json-schema']
	},
	server: {
		port: 8174,
		host: true,
		proxy: {
			// `npm run dev` at the repo root runs the Worker on :8790.
			'/mcp': { target: 'http://127.0.0.1:8790', changeOrigin: true },
			'/api': { target: 'http://127.0.0.1:8790', changeOrigin: true },
			'/health': { target: 'http://127.0.0.1:8790', changeOrigin: true },
			'/llms.txt': { target: 'http://127.0.0.1:8790', changeOrigin: true }
		},
		fs: { allow: ['..'], strict: false }
	}
});
