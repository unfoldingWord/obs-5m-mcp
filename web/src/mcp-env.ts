/** Minimal Env shape for chat API (matches src/mcp/agent Env fields used by tools). */
export interface Env {
	OPENAI_API_KEY?: string;
	PUBLIC_BASE_URL?: string;
	OBS_5M_CACHE?: KVNamespace;
	ASSETS_BUCKET?: R2Bucket;
	[key: string]: unknown;
}
