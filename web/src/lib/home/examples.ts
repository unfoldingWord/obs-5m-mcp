export type HomeExample = { ask: string; tool: string; args: Record<string, unknown> };

/** What a person might ask an assistant, and the call it leads to. */
export const HOME_EXAMPLES: HomeExample[] = [
	{
		ask: 'Walk our group through the Theological Dialogue for the story of Abraham.',
		tool: 'fetch_obs_study_manual',
		args: { reference: '4', part: 'movement2' }
	},
	{
		ask: 'What observation questions go with panel 5 of the creation story?',
		tool: 'fetch_obs_study_manual',
		args: { reference: '1:5', part: 'movement1' }
	},
	{
		ask: 'Which stories are in the unit about Jesus’ death and resurrection?',
		tool: 'list_stories',
		args: { collection: 9 }
	},
	{
		ask: 'Which stories talk about forgiveness?',
		tool: 'search_content',
		args: { query: 'forgiveness' }
	},
	{
		ask: 'In which languages can I study these stories?',
		tool: 'list_languages',
		args: {}
	}
];
