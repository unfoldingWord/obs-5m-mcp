<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	let { source }: { source: string } = $props();
	const html = $derived(renderMarkdown(source));
</script>

<!-- Sanitized in renderMarkdown; empty during prerender, filled in the browser. -->
<div class="prose">{@html html}</div>
