/**
 * Study languages from MCP list_languages (DCS OBS-TF catalog + id fallback).
 * The chat picker must not invent codes that have no study manual.
 */

import { apiFetch } from '$lib/paths.js';

export interface CatalogLanguage {
	code: string;
	name: string;
}

export function languagesFromToolResult(raw: unknown): CatalogLanguage[] {
	const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const structured =
		root.structuredContent && typeof root.structuredContent === 'object'
			? (root.structuredContent as Record<string, unknown>)
			: root;
	const list = structured.languages;
	if (!Array.isArray(list)) return [];

	const out: CatalogLanguage[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const code = String((item as { code?: unknown }).code ?? '')
			.trim()
			.toLowerCase();
		if (!code || seen.has(code)) continue;
		seen.add(code);
		const nameRaw = (item as { name?: unknown }).name;
		const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : code;
		out.push({ code, name });
	}
	return out;
}

export async function fetchCatalogLanguages(): Promise<CatalogLanguage[]> {
	const res = await apiFetch('/api/tool', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ tool: 'list_languages', arguments: {} })
	});
	if (!res.ok) return [];
	return languagesFromToolResult(await res.json());
}

export function pickAvailableLanguage(
	wanted: string | undefined,
	catalog: CatalogLanguage[]
): string {
	const code = wanted?.trim().toLowerCase() ?? '';
	if (code && catalog.some((l) => l.code === code)) return code;
	return catalog[0]?.code ?? 'en';
}
