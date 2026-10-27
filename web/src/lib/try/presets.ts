export type Preset = {
	label: string;
	tool: string;
	args: Record<string, unknown>;
	/** A parameter the live schema must have for this preset to show. */
	needs?: string;
};

export const PRESETS: Preset[] = [
	{
		label: 'Story 1, panels 5–8, questions only',
		tool: 'fetch_obs_study_manual',
		args: { reference: '1:5-8', part: 'movement1', include_answers: false },
		needs: 'include_answers'
	},
	{
		label: 'Story 1, Movement 1',
		tool: 'fetch_obs_study_manual',
		args: { reference: '1', part: 'movement1', format: 'md' }
	},
	{ label: 'All stories', tool: 'list_stories', args: {} },
	{ label: 'Languages', tool: 'list_languages', args: {} },
	{ label: 'Search “forgiveness”', tool: 'search_content', args: { query: 'forgiveness' } }
];
