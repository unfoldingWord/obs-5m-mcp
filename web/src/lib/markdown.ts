import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em',
	'a', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

/** Markdown from the server to safe HTML: only structural tags and http(s) links. */
export function renderMarkdown(md: string): string {
	const html = marked.parse(md, { async: false, gfm: true }) as string;
	const clean = DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ['href'],
		ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i
	});
	return clean.replace(/<a href=/g, '<a target="_blank" rel="noopener noreferrer" href=');
}
