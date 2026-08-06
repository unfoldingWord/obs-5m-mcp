/**
 * OBS session store — same shape ChatDock expects from TH studySession,
 * but scoped to story/language/part instead of scripture passage/TN/TW.
 */

import { derived, writable } from 'svelte/store';
import type { WorkflowMode } from '$lib/obs/workflowMode';
import type { SessionRole } from '$lib/obs/sessionRole';

export type WorkflowModeExport = WorkflowMode;

export interface ObsScope {
	kind: 'none' | 'story' | 'resource';
	label: string;
}

export interface ObsSessionState {
	story: number;
	language: string;
	/** Optional receptor / drafting language label */
	targetLanguage: string;
	reference: string;
	workflowMode: WorkflowMode;
	/** Leader (facilitator) vs Member (participant) — orthogonal to Study/Translate/Check */
	role: SessionRole;
	scope: ObsScope;
	part: string | null;
}

const initial: ObsSessionState = {
	story: 1,
	language: 'en',
	targetLanguage: 'en',
	reference: '1',
	workflowMode: 'study',
	role: 'leader',
	scope: { kind: 'story', label: 'OBS 1' },
	part: null
};

function createSession() {
	const { subscribe, update, set } = writable<ObsSessionState>(initial);

	return {
		subscribe,
		set,
		reset() {
			set({ ...initial });
		},
		setStory(story: number) {
			update((s) => ({
				...s,
				story,
				reference: String(story),
				scope: { kind: 'story', label: `OBS ${story}` }
			}));
		},
		setLanguagePair(source: string, target?: string) {
			update((s) => ({
				...s,
				language: source,
				targetLanguage: target ?? source
			}));
		},
		setWorkflowMode(mode: WorkflowMode) {
			update((s) => ({ ...s, workflowMode: mode }));
		},
		setRole(role: SessionRole) {
			update((s) => ({ ...s, role }));
		},
		setPart(part: string | null) {
			update((s) => ({ ...s, part }));
		},
		clearScope() {
			update((s) => ({
				...s,
				scope: { kind: 'none', label: '' },
				part: null
			}));
		}
	};
}

export const studySession = createSession();

export function setLanguagePair(source: string, target?: string) {
	studySession.setLanguagePair(source, target);
}

export function setWorkflowMode(mode: WorkflowMode) {
	studySession.setWorkflowMode(mode);
}

export function setSessionRole(role: SessionRole) {
	studySession.setRole(role);
}

export function clearScope() {
	studySession.clearScope();
}

export function resetSession() {
	studySession.reset();
}

export const contextSnapshot = derived(studySession, ($s) => ({
	story: $s.story,
	language: $s.language,
	mode: $s.workflowMode,
	role: $s.role,
	part: $s.part
}));
