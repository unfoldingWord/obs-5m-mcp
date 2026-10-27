import { DEFAULT_ORIGIN, endpointFor } from './site';

/** The origin of the site being viewed. The layout sets it once mounted. */
export const live = $state({ origin: DEFAULT_ORIGIN });

/**
 * The MCP endpoint of the site being viewed. In the browser it always comes
 * from the page's own origin, even before the layout has mounted (child
 * components mount first); during prerender it is the production URL.
 */
export function endpoint(): string {
	const origin = live.origin;
	if (origin === DEFAULT_ORIGIN && typeof window !== 'undefined') {
		return endpointFor(window.location.origin);
	}
	return endpointFor(origin);
}
