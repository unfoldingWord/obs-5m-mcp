import { DEFAULT_ORIGIN, endpointFor } from './site';

/** The origin of the site being viewed, set by the layout once in the browser. */
export const live = $state({ origin: DEFAULT_ORIGIN });

export function endpoint(): string {
	return endpointFor(live.origin);
}
