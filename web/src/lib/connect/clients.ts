const SERVER_KEY = 'obs-tf';

function toBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

/** One-click install link for Cursor. */
export function cursorDeeplink(endpoint: string): string {
	const config = toBase64(JSON.stringify({ url: endpoint }));
	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_KEY}&config=${encodeURIComponent(config)}`;
}

/** One-click install link for VS Code (format as used by published MCP servers). */
export function vscodeDeeplink(endpoint: string): string {
	const config = JSON.stringify({ type: 'http', url: endpoint });
	return `https://vscode.dev/redirect/mcp/install?name=${SERVER_KEY}&config=${encodeURIComponent(config)}`;
}

export type ClientSetup = {
	id: string;
	label: string;
	steps: string;
	tabs: { label: string; code: string }[];
	install?: { label: string; href: string };
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Setup for each client, checked against each client's docs (October 2026). */
export function CLIENTS(endpoint: string): ClientSetup[] {
	return [
		{
			id: 'claude-code',
			label: 'Claude Code',
			steps: 'Run this once in your terminal. The server is then available in every Claude Code session.',
			tabs: [{ label: 'Terminal', code: `claude mcp add --transport http ${SERVER_KEY} ${endpoint}` }]
		},
		{
			id: 'claude',
			label: 'Claude Desktop and claude.ai',
			steps:
				'In Claude, open Settings, then Connectors, and choose Add custom connector. Paste the URL below and give it a name. On plans without custom connectors, Claude Desktop can reach the server through mcp-remote in claude_desktop_config.json.',
			tabs: [
				{ label: 'Connector URL', code: endpoint },
				{
					label: 'claude_desktop_config.json',
					code: json({ mcpServers: { [SERVER_KEY]: { command: 'npx', args: ['-y', 'mcp-remote', endpoint] } } })
				}
			]
		},
		{
			id: 'cursor',
			label: 'Cursor',
			steps: 'Use the install button, or add the server to ~/.cursor/mcp.json (all projects) or .cursor/mcp.json (one project).',
			tabs: [{ label: 'mcp.json', code: json({ mcpServers: { [SERVER_KEY]: { url: endpoint } } }) }],
			install: { label: 'Install in Cursor', href: cursorDeeplink(endpoint) }
		},
		{
			id: 'vscode',
			label: 'VS Code',
			steps:
				'Use the install button, run the command, or add the server to .vscode/mcp.json. VS Code uses the key "servers", not "mcpServers".',
			tabs: [
				{ label: '.vscode/mcp.json', code: json({ servers: { [SERVER_KEY]: { type: 'http', url: endpoint } } }) },
				{
					label: 'Terminal',
					code: `code --add-mcp '${JSON.stringify({ name: SERVER_KEY, type: 'http', url: endpoint })}'`
				}
			],
			install: { label: 'Install in VS Code', href: vscodeDeeplink(endpoint) }
		},
		{
			id: 'codex',
			label: 'Codex',
			steps: 'Run the command, or add the server to ~/.codex/config.toml. Check it with codex mcp list.',
			tabs: [
				{ label: 'Terminal', code: `codex mcp add ${SERVER_KEY} --url ${endpoint}` },
				{ label: 'config.toml', code: `[mcp_servers.${SERVER_KEY}]\nurl = "${endpoint}"` }
			]
		},
		{
			id: 'bt-servant',
			label: 'BT Servant',
			steps:
				'BT Servant already uses this server. Its MCP servers are set by unfoldingWord admins in the BT Servant admin portal, so there is nothing to install.',
			tabs: []
		},
		{
			id: 'other',
			label: 'Other clients',
			steps:
				'Any client that supports MCP over Streamable HTTP can use the URL as is. For a client that only starts local servers, run it through mcp-remote.',
			tabs: [
				{ label: 'URL', code: endpoint },
				{ label: 'mcp-remote', code: `npx -y mcp-remote ${endpoint}` }
			]
		}
	];
}
