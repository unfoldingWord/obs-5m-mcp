/** Workers SSR has no DOM — passthrough stub for isomorphic-dompurify. */
export default {
	sanitize(html: string) {
		return html;
	}
};
