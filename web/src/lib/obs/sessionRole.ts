/**
 * Leader vs Member — UI angle (mirrors src/chat/sessionRole.ts).
 */

export type SessionRole = 'leader' | 'member';

export const SESSION_ROLES: SessionRole[] = ['leader', 'member'];

export function parseSessionRole(value: unknown): SessionRole {
	return value === 'member' ? 'member' : 'leader';
}

export function sessionRoleLabel(role: SessionRole): string {
	return role === 'member' ? 'Member' : 'Leader';
}

export function sessionRoleHint(role: SessionRole): string {
	return role === 'member'
		? 'Help me participate in a Five Movements group'
		: 'Help me lead / train a Five Movements group';
}
