/** Quote a value for a POSIX shell. */
function sh(value: string): string {
	return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** The same call as a curl command against the MCP endpoint. */
export function curlFor(endpoint: string, tool: string, args: object): string {
	const body = JSON.stringify({
		jsonrpc: '2.0',
		id: 1,
		method: 'tools/call',
		params: { name: tool, arguments: args }
	});
	return [
		`curl -X POST ${sh(endpoint)}`,
		`  -H 'Content-Type: application/json'`,
		`  -H 'Accept: application/json, text/event-stream'`,
		`  -d ${sh(body)}`
	].join(' \\\n');
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
