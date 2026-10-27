/**
 * Open Bible Stories illustrations used on the site, saved in web/static/obs from
 * cdn.door43.org. Illustrations © Sweet Publishing, CC BY-SA 3.0, as the OBS
 * license requires (https://git.door43.org/unfoldingWord/en_obs, LICENSE.md).
 */
export const ART_CREDIT = {
	text: 'Illustrations © Sweet Publishing, CC BY-SA 3.0',
	href: 'https://www.sweetpublishing.com',
	license: 'https://creativecommons.org/licenses/by-sa/3.0/'
} as const;

export type Panel = { id: string; story: number; title: string };

/** Eight panels that walk the whole story, Creation to New Creation. */
export const STORYBOARD: Panel[] = [
	{ id: '01-05', story: 1, title: 'The Creation' },
	{ id: '04-04', story: 4, title: 'God’s Covenant with Abraham' },
	{ id: '12-12', story: 12, title: 'The Exodus' },
	{ id: '17-02', story: 17, title: 'God’s Covenant with David' },
	{ id: '23-09', story: 23, title: 'The Birth of Jesus' },
	{ id: '31-07', story: 31, title: 'Jesus Walks on Water' },
	{ id: '41-07', story: 41, title: 'God Raises Jesus from the Dead' },
	{ id: '50-17', story: 50, title: 'Jesus Returns' }
];

export const panelSrc = (id: string, width: 560 | 1280 = 560) => `/obs/obs-${id}-${width}.jpg`;
