import type { CallResult } from '../mcp/client.js';

export type RenderedView =
	| { kind: 'markdown'; text: string }
	| { kind: 'json'; summary: string; json: string }
	| { kind: 'text'; text: string };

/** What the Rendered tab shows for a tool answer. */
export function renderedView(result: CallResult): RenderedView {
	const content = result.structured?.content;
	if (typeof content === 'string') return { kind: 'markdown', text: content };
	if (result.structured) {
		// Text content is a one-line summary followed by the same data as JSON.
		const first = result.text.split('\n\n')[0]?.trim() ?? '';
		const summary = /^\s*[[{]/.test(first) ? '' : first;
		return { kind: 'json', summary, json: JSON.stringify(result.structured, null, 2) };
	}
	return { kind: 'text', text: result.text };
}
