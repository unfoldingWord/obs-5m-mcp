export type TryState = {
	tab: 'guided' | 'tools';
	tool?: string;
	args?: Record<string, unknown>;
	lang?: string;
	story?: number;
	part?: string;
	view?: 'leader' | 'community';
};

const FALLBACK: TryState = { tab: 'guided' };

function toBase64Url(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
	const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeTryState(s: TryState): string {
	return '#' + toBase64Url(JSON.stringify(s));
}

/** Read the try page state from a URL hash. Never throws; odd input gives the guided tab. */
export function decodeTryState(hash: string, knownTools: string[]): TryState {
	let raw: unknown;
	try {
		raw = JSON.parse(fromBase64Url(hash.replace(/^#/, '')));
	} catch {
		return { ...FALLBACK };
	}
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...FALLBACK };
	const r = raw as Record<string, unknown>;
	if (r.tab !== 'guided' && r.tab !== 'tools') return { ...FALLBACK };

	const out: TryState = { tab: r.tab };
	const isPlainObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
	for (const [key, value] of Object.entries(r)) {
		switch (key) {
			case 'tab':
				break;
			case 'tool':
				if (typeof value === 'string' && knownTools.includes(value)) out.tool = value;
				break;
			case 'args':
				if (!isPlainObject(value)) return { ...FALLBACK };
				out.args = value as Record<string, unknown>;
				break;
			case 'lang':
			case 'part':
				if (typeof value !== 'string') return { ...FALLBACK };
				out[key] = value;
				break;
			case 'story':
				if (typeof value !== 'number' || !Number.isInteger(value)) return { ...FALLBACK };
				out.story = value;
				break;
			case 'view':
				if (value !== 'leader' && value !== 'community') return { ...FALLBACK };
				out.view = value;
				break;
			default:
				return { ...FALLBACK };
		}
	}
	return out;
}
