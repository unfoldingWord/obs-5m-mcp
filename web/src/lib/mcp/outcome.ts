import type { CallResult } from './client.js';

export type Outcome =
	| { kind: 'ok' }
	| { kind: 'not-available'; message: string }
	| { kind: 'upstream'; message: string }
	| { kind: 'rate-limited'; retryAfterSeconds: number }
	| { kind: 'error'; message: string };

const UPSTREAM = /UPSTREAM_DCS_ERROR/;

/** Sort a tool call into what the page should tell the person. */
export function classifyOutcome(input: {
	status: number;
	result?: CallResult;
	error?: unknown;
	retryAfter?: string | null;
}): Outcome {
	if (input.status === 429) {
		const n = Number.parseInt(input.retryAfter ?? '', 10);
		return { kind: 'rate-limited', retryAfterSeconds: Number.isFinite(n) && n > 0 ? n : 60 };
	}
	if (input.error !== undefined) {
		const message = input.error instanceof Error ? input.error.message : String(input.error);
		return UPSTREAM.test(message) ? { kind: 'upstream', message } : { kind: 'error', message };
	}
	const result = input.result;
	if (!result) return { kind: 'error', message: 'No answer from the server.' };
	if (result.structured?.available === false) {
		const message = String(result.structured.message ?? 'This content is not available.');
		return { kind: 'not-available', message };
	}
	if (result.isError) {
		return UPSTREAM.test(result.text)
			? { kind: 'upstream', message: result.text }
			: { kind: 'error', message: result.text || 'The tool returned an error.' };
	}
	return { kind: 'ok' };
}
