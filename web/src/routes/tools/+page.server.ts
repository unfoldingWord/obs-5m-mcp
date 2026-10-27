import { buildToolCatalog } from '$lib/catalog';

// Runs at build time only, so the server's code never ships to the browser.
export const load = () => ({ tools: buildToolCatalog() });
