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

/** One-click install link for VS Code. */
export function vscodeDeeplink(endpoint: string): string {
	const config = JSON.stringify({ name: SERVER_KEY, type: 'http', url: endpoint });
	return `https://vscode.dev/redirect/mcp/install?name=${SERVER_KEY}&config=${encodeURIComponent(config)}`;
}
