<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { withBase } from '$lib/paths';

	onMount(() => {
		goto(withBase('/chat'), { replaceState: true });
	});
</script>

<p class="p-6 text-sm text-[var(--muted)]">Redirecting to chat…</p>
