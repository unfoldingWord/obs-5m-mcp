/** Quote a value for a POSIX shell. */
function sh(value: string): string {
	return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The same call as curl commands. The server needs a session, so the first
 * command opens one and keeps its id, and the second makes the call. The server
 * keeps each event stream open after answering, so curl stops after a time limit.
 */
export function curlFor(endpoint: string, tool: string, args: object): string {
	const init = JSON.stringify({
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'curl', version: '1' } }
	});
	const call = JSON.stringify({
		jsonrpc: '2.0',
		id: 2,
		method: 'tools/call',
		params: { name: tool, arguments: args }
	});
	const headers = `-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'`;
	return [
		'# 1. Open a session and keep its id',
		`SID=$(curl -s --max-time 5 -D - -o /dev/null -X POST ${sh(endpoint)} ${headers} \\`,
		`  -d ${sh(init)} | tr -d '\\r' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')`,
		'',
		'# 2. Call the tool',
		`curl -s --max-time 20 -X POST ${sh(endpoint)} ${headers} \\`,
		`  -H "Mcp-Session-Id: $SID" \\`,
		`  -d ${sh(call)}`
	].join('\n');
}

/** The same call with the MCP Inspector CLI. */
export function inspectorFor(endpoint: string, tool: string, args: object): string {
	const parts = [
		`npx @modelcontextprotocol/inspector --cli ${sh(endpoint)} --transport http`,
		`--method tools/call --tool-name ${sh(tool)}`,
		...Object.entries(args).map(
			([k, v]) => `--tool-arg ${sh(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)}`
		)
	];
	return parts.join(' ');
}
