/** One place for the site's name and the links every page uses. */
export const SITE = {
	name: 'OBS-TF MCP',
	repo: 'https://github.com/unfoldingWord/obs-5m-mcp',
	links: {
		formationStories: 'https://formationstories.org/',
		openBibleStories: 'https://www.openbiblestories.org/',
		smc: 'https://strategicmissioncollective.org/',
		door43: 'https://door43.org',
		enRepo: 'https://git.door43.org/unfoldingWord/en_obs-tf',
		idRepo: 'https://git.door43.org/unfoldingWord/id_obs-tf',
		overview:
			'https://git.door43.org/unfoldingWord/en_obs-tf/src/branch/master/transclusions/overview.md',
		uwContent: 'https://unfoldingword.org/for-translators/content/',
		license: 'https://creativecommons.org/licenses/by-sa/4.0/'
	}
} as const;

export const nav = [
	{ href: '/try', label: 'Try it' },
	{ href: '/connect', label: 'Connect' },
	{ href: '/tools', label: 'Tools' },
	{ href: '/docs', label: 'Docs' }
] as const;

/** The MCP endpoint of the site being viewed (a preview shows its own). */
export function endpointFor(origin: string): string {
	return `${origin.replace(/\/$/, '')}/mcp`;
}

/** Shown during prerender, before the browser knows its origin. */
export const DEFAULT_ORIGIN = 'https://obs-5m-mcp.unfoldingword.workers.dev';
