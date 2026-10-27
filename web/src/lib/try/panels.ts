/**
 * Whether the guided session's panel field is usable on this server:
 * empty, one panel ("5"), or a range ("5-8") when the server supports ranges.
 */
export function validPanels(input: string, supportsRanges: boolean): boolean {
	const value = input.trim();
	if (value === '') return true;
	if (/^\d+$/.test(value)) return true;
	const range = /^(\d+)-(\d+)$/.exec(value);
	return supportsRanges && !!range && Number(range[1]) <= Number(range[2]);
}
