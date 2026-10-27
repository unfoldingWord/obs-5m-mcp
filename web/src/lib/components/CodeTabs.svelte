<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	let { tabs }: { tabs: { label: string; code: string }[] } = $props();
	let active = $state(0);
	let copied = $state(false);
	const current = $derived(tabs[Math.min(active, tabs.length - 1)]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(current.code);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<div class="overflow-hidden rounded-lg border border-line bg-surface">
	<div class="flex items-center gap-1 overflow-x-auto border-b border-line px-2" role="tablist">
		{#each tabs as tab, i}
			<button
				type="button"
				role="tab"
				aria-selected={i === active}
				onclick={() => (active = i)}
				class="shrink-0 border-b-2 px-2.5 py-2 text-xs {i === active
					? 'border-accent text-ink'
					: 'border-transparent text-ink-2 hover:text-ink'}">{tab.label}</button
			>
		{/each}
		<button
			type="button"
			onclick={copy}
			class="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-2 text-xs text-ink-2 hover:text-ink"
			aria-label="Copy code"
		>
			{#if copied}<Check size={14} /> Copied{:else}<Copy size={14} /> Copy{/if}
		</button>
	</div>
	<pre class="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-ink"><code
			>{current.code}</code
		></pre>
</div>
