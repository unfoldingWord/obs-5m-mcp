import type { StudyManualPart } from '../../../../src/content/studyManual.js';

export type AnatomyPart = {
	part: StudyManualPart;
	title: string;
	group: 'story' | 'movements';
	contains: string[];
	ask: string;
	call: { reference: string; part: StudyManualPart; include_answers?: false };
};

/**
 * The parts of one OBS-TF story, in the order the manual uses.
 * Titles of the Five Movements are the manual's own
 * (https://formationstories.org/introduction/).
 */
export const ANATOMY_PARTS: AnatomyPart[] = [
	{
		part: 'intro',
		title: 'Introduction',
		group: 'story',
		contains: ['Key idea', 'Creedal verse', 'Metanarrative summary'],
		ask: 'What is the key idea of the creation story?',
		call: { reference: '1', part: 'intro' }
	},
	{
		part: 'frames',
		title: 'The story',
		group: 'story',
		contains: ['The story text in numbered panels (01-01, 01-02, …)', 'An image for each panel', 'The Bible passages it retells'],
		ask: 'Show me the creation story.',
		call: { reference: '1', part: 'frames' }
	},
	{
		part: 'community',
		title: 'Community study',
		group: 'story',
		contains: ['A devotional the community reads together before the movements'],
		ask: 'What do we read together before studying story 1?',
		call: { reference: '1', part: 'community' }
	},
	{
		part: 'movement1',
		title: 'Biblical Interpretation: Observing the Details of the Story',
		group: 'movements',
		contains: ['Observation questions for each panel, with answers', 'Translation questions on key terms for each panel'],
		ask: 'Show our group Movement 1 for panels 5 to 8, without the answers.',
		call: { reference: '1:5-8', part: 'movement1', include_answers: false }
	},
	{
		part: 'movement2',
		title: 'Theological Dialogue: Discussing the Meaning of the Story',
		group: 'movements',
		contains: ['Discourse questions that span several panels', 'Theological questions', 'Making the translation draft'],
		ask: 'What should we discuss about the meaning of story 1?',
		call: { reference: '1', part: 'movement2' }
	},
	{
		part: 'movement3',
		title: 'Personal Reflection: Following the Teaching of the Story',
		group: 'movements',
		contains: ['Journal reflection', 'The team check of the draft'],
		ask: 'How do we reflect on story 1 and check our draft?',
		call: { reference: '1', part: 'movement3' }
	},
	{
		part: 'movement4',
		title: 'Ministry Practice: Serving the Church with the Story',
		group: 'movements',
		contains: ['Church ministry', 'The church community check of the translation'],
		ask: 'How can our church serve with story 1?',
		call: { reference: '1', part: 'movement4' }
	},
	{
		part: 'movement5',
		title: 'Missional Outreach: Sharing the Truth of the Story',
		group: 'movements',
		contains: ['Mission engagement', 'The sociolinguistic check with new hearers'],
		ask: 'How do we share story 1 with people outside the church?',
		call: { reference: '1', part: 'movement5' }
	},
	{
		part: 'conclusion',
		title: 'Conclusion',
		group: 'story',
		contains: ['A community review that closes the story'],
		ask: 'How does the session on story 1 end?',
		call: { reference: '1', part: 'conclusion' }
	}
];
