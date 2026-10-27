<script lang="ts">
	import Markdown from './Markdown.svelte';
	import Callout from './Callout.svelte';
	import type { CallResult } from '$lib/mcp/client';
	import type { Outcome } from '$lib/mcp/outcome';

	let {
		tool = '',
		result,
		outcome,
		pending = false,
		onretry
	}: {
		tool?: string;
		result: CallResult | null;
		outcome: Outcome | null;
		pending?: boolean;
		onretry?: () => void;
	} = $props();

	type Tab = 'rendered' | 'json' | 'rpc';
	const TABS: [Tab, string][] = [
		['rendered', 'Rendered'],
		['json', 'JSON'],
		['rpc', 'JSON-RPC']
	];
	let tab = $state<Tab>('rendered');
	const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
	const rendered = $derived(
		typeof result?.structured?.content === 'string'
			? (result.structured.content as string)
			: (result?.text ?? '')
	);
	const looksLikeJson = $derived(/^\s*[[{]/.test(rendered));
</script>

<section class="min-w-0 rounded-lg border border-line bg-surface" aria-live="polite">
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3">
		<div class="flex gap-1" role="tablist">
			{#each TABS as [id, label]}
				<button
					type="button"
					role="tab"
					aria-selected={tab === id}
					onclick={() => (tab = id)}
					class="border-b-2 px-2 py-2 text-xs {tab === id
						? 'border-accent text-ink'
						: 'border-transparent text-ink-2 hover:text-ink'}">{label}</button
				>
			{/each}
		</div>
		{#if result}
			<p class="ml-auto font-mono text-[11px] text-accent-2">
				{tool} · {kb(result.exchange.bytes)} · {result.exchange.ms} ms
			</p>
		{/if}
	</div>
	<div class="max-h-[70vh] overflow-auto p-4">
		{#if pending}
			<p class="text-sm text-ink-2">Calling the server…</p>
		{:else if outcome && outcome.kind !== 'ok'}
			{#if outcome.kind === 'not-available'}
				<Callout>{outcome.message}</Callout>
			{:else if outcome.kind === 'upstream'}
				<Callout tone="warn">
					Couldn't reach Door43. Retry in a moment.
					{#if onretry}
						<button type="button" class="ml-2 underline" onclick={onretry}>Retry</button>
					{/if}
				</Callout>
			{:else if outcome.kind === 'rate-limited'}
				<Callout tone="warn"
					>Too many requests. Try again in {outcome.retryAfterSeconds} seconds.</Callout
				>
			{:else}
				<Callout tone="warn">{outcome.message}</Callout>
			{/if}
		{:else if !result}
			<p class="text-sm text-ink-2">Run a call to see what the server returns.</p>
		{:else if tab === 'rendered'}
			{#if looksLikeJson}
				<pre class="overflow-x-auto font-mono text-xs text-ink">{rendered}</pre>
			{:else}
				<Markdown source={rendered} />
			{/if}
		{:else if tab === 'json'}
			<pre class="overflow-x-auto font-mono text-xs text-ink">{JSON.stringify(
					result.structured,
					null,
					2
				)}</pre>
		{:else}
			<p class="mb-1 text-xs text-ink-2">Request</p>
			<pre class="mb-4 overflow-x-auto font-mono text-xs text-ink">{JSON.stringify(
					result.exchange.request,
					null,
					2
				)}</pre>
			<p class="mb-1 text-xs text-ink-2">Response (HTTP {result.exchange.status})</p>
			<pre class="overflow-x-auto font-mono text-xs text-ink">{JSON.stringify(
					result.exchange.response,
					null,
					2
				)}</pre>
		{/if}
	</div>
</section>
