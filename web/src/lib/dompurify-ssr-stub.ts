// Prerender has no DOM. Markdown is rendered in the browser, so on the server
// sanitize returns nothing and the component fills in after hydration.
const stub = { sanitize: (_html: string, _opts?: unknown): string => '' };
export default stub;
