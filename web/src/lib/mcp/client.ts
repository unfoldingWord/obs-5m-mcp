/**
 * Minimal MCP client for the browser (Streamable HTTP, JSON-RPC 2.0).
 * It records every request and response so the try page can show the
 * protocol as it happened.
 */

export type JsonSchema = Record<string, unknown> & { type?: string };

export type Exchange = {
	request: unknown;
	response: unknown;
	status: number;
	bytes: number;
	ms: number;
};

export type ToolInfo = {
	name: string;
	description: string;
	inputSchema: JsonSchema;
	annotations?: { readOnlyHint?: boolean; title?: string };
};

export type CallResult = {
	text: string;
	structured: Record<string, unknown> | null;
	isError: boolean;
	exchange: Exchange;
};

/** HTTP-level failure (for example 429 from the rate limit). */
export class McpHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfter: string | null
	) {
		super(message);
	}
}

const PROTOCOL_VERSION = '2025-03-26';

/** Parse a JSON or SSE response body into the JSON-RPC message it carries. */
export function parseRpcBody(contentType: string, body: string): unknown {
	if (contentType.includes('text/event-stream')) {
		const data = body
			.split(/\r?\n/)
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.filter(Boolean);
		const last = data.at(-1);
		return last ? JSON.parse(last) : null;
	}
	return body.trim() ? JSON.parse(body) : null;
}

export class McpHttpClient {
	readonly log: Exchange[] = [];
	private sessionId: string | null = null;
	private nextId = 1;

	constructor(
		private readonly endpoint: string,
		private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)
	) {}

	async initialize(): Promise<void> {
		await this.request('initialize', {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: 'obs-tf-site', version: '1' }
		});
		await this.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
	}

	async listTools(): Promise<ToolInfo[]> {
		const { message } = await this.request('tools/list', {});
		return ((message.result as { tools?: ToolInfo[] })?.tools ?? []) as ToolInfo[];
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<CallResult> {
		const { message, exchange } = await this.request('tools/call', { name, arguments: args });
		const result = (message.result ?? {}) as {
			content?: Array<{ type: string; text?: string }>;
			structuredContent?: Record<string, unknown>;
			isError?: boolean;
		};
		const text = (result.content ?? [])
			.filter((c) => c.type === 'text' && typeof c.text === 'string')
			.map((c) => c.text)
			.join('\n\n');
		return {
			text,
			structured: result.structuredContent ?? null,
			isError: Boolean(result.isError),
			exchange
		};
	}

	private async request(method: string, params: Record<string, unknown>) {
		const payload = { jsonrpc: '2.0', id: this.nextId++, method, params };
		const { message, exchange } = await this.send(payload);
		const rpc = (message ?? {}) as { result?: unknown; error?: { message?: string } };
		if (rpc.error) throw new Error(rpc.error.message ?? 'The server returned an error.');
		return { message: rpc, exchange };
	}

	private async send(payload: Record<string, unknown>) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream'
		};
		if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
		if (payload.method !== 'initialize') headers['Mcp-Protocol-Version'] = PROTOCOL_VERSION;

		const started = performance.now();
		const res = await this.fetchImpl(this.endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload)
		});
		const body = await res.text();
		const ms = Math.round(performance.now() - started);
		const sid = res.headers.get('Mcp-Session-Id');
		if (sid) this.sessionId = sid;

		if (!res.ok && res.status !== 202) {
			throw new McpHttpError(
				`The server answered ${res.status}.`,
				res.status,
				res.headers.get('Retry-After')
			);
		}
		const message = parseRpcBody(res.headers.get('Content-Type') ?? '', body);
		const exchange: Exchange = {
			request: payload,
			response: message,
			status: res.status,
			bytes: new TextEncoder().encode(body).length,
			ms
		};
		if ('id' in payload) this.log.push(exchange);
		return { message, exchange };
	}
}
