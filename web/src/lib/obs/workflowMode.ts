/**
 * OBS session modes — same Study / Translate / Check tabs as TH ChatDock,
 * mapped onto Five Movements sessionFlow parts.
 */

export type WorkflowMode = 'study' | 'translate' | 'check';

export const WORKFLOW_MODES: WorkflowMode[] = ['study', 'translate', 'check'];

export function workflowModeHint(mode: WorkflowMode, _lang = 'en'): string {
	switch (mode) {
		case 'study':
			return 'Intro, frames, community study, observe & discuss';
		case 'translate':
			return 'Draft the story panels and journal reflection';
		case 'check':
			return 'Team quality check, ministry, mission, conclusion';
		default:
			return '';
	}
}

export function parseWorkflowMode(value: unknown): WorkflowMode {
	if (value === 'translate' || value === 'check' || value === 'study') return value;
	return 'study';
}

/** Quick chips for each mode (OBS study for translation). */
export function chipsForMode(
	mode: WorkflowMode,
	story: number
): Array<{ label: string; prompt: string }> {
	const s = String(story);
	if (mode === 'study') {
		return [
			{
				label: 'Full lesson',
				prompt: `Compile the full formatted lesson for OBS story ${s} (fetch_obs_study_manual part=full format=md) and present it.`
			},
			{
				label: 'Intro',
				prompt: `Open part=intro for OBS story ${s} and orient the team.`
			},
			{
				label: 'Frames',
				prompt: `Show the story frames (part=frames) for OBS story ${s}.`
			},
			{
				label: 'Community',
				prompt: `Facilitate Community Study (part=community) for OBS story ${s}.`
			},
			{
				label: 'Observe',
				prompt: `Lead movement 1 observation + translation terms (part=movement1) for story ${s}.`
			},
			{
				label: 'Discuss',
				prompt: `Lead movement 2 discourse + theological questions (part=movement2) for story ${s}.`
			}
		];
	}
	if (mode === 'translate') {
		return [
			{
				label: 'Draft',
				prompt: `Open translation drafting (part=drafting) for OBS story ${s} and walk the steps.`
			},
			{
				label: 'Journal',
				prompt: `Open journal reflection (part=movement3) for OBS story ${s}.`
			}
		];
	}
	return [
		{
			label: 'Team check',
			prompt: `Open team checking questions (part=checking) for OBS story ${s}.`
		},
		{
			label: 'Ministry',
			prompt: `Open ministry practice (part=movement4) for OBS story ${s}.`
		},
		{
			label: 'Mission',
			prompt: `Open missional outreach (part=movement5) for OBS story ${s}.`
		},
		{
			label: 'Conclusion',
			prompt: `Open the conclusion (part=conclusion) for OBS story ${s}.`
		}
	];
}
