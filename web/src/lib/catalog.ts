import { zodToJsonSchema } from 'zod-to-json-schema';
import { MCP_TOOLS } from '../../../src/mcp/toolRegistry.js';
import type { JsonSchema } from './mcp/client.js';

export type ToolGroup = 'primary' | 'discovery' | 'helpers';

export type ToolDoc = {
	name: string;
	title: string;
	description: string;
	readOnly: boolean;
	inputSchema: JsonSchema;
	group: ToolGroup;
};

const GROUP_ORDER: ToolGroup[] = ['primary', 'discovery', 'helpers'];
const DISCOVERY = new Set([
	'list_languages',
	'list_resources',
	'list_collections',
	'list_stories',
	'get_framework'
]);

function groupOf(name: string): ToolGroup {
	if (name === 'fetch_obs_study_manual') return 'primary';
	return DISCOVERY.has(name) ? 'discovery' : 'helpers';
}

/** Tool reference built from the server's own registry, so it cannot drift. */
export function buildToolCatalog(): ToolDoc[] {
	const docs = MCP_TOOLS.map((t) => {
		const schema = zodToJsonSchema(t.inputSchema, { $refStrategy: 'none' }) as JsonSchema;
		delete schema.$schema;
		return {
			name: t.name,
			title: t.annotations.title,
			description: t.description,
			readOnly: t.annotations.readOnlyHint,
			inputSchema: schema,
			group: groupOf(t.name)
		};
	});
	return docs.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}
