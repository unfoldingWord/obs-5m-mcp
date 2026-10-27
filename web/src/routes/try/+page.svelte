<script lang="ts">
	import { onMount } from 'svelte';
	import CopyPill from '$lib/components/CopyPill.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import GuidedSession from '$lib/try/GuidedSession.svelte';
	import ToolRunner from '$lib/try/ToolRunner.svelte';
	import { endpoint } from '$lib/endpoint.svelte';
	import { connect } from '$lib/mcp/session';
	import type { ToolInfo } from '$lib/mcp/client';
	import { decodeTryState, encodeTryState, type TryState } from '$lib/try/hashState';
	import { SITE } from '$lib/site';

	let status = $state<'connecting' | 'connected' | 'failed'>('connecting');
	let tools = $state<ToolInfo[]>([]);
	let tryState = $state<TryState>({ tab: 'guided' });

	function save(s: TryState) {
		tryState = s;
		history.replaceState(history.state, '', '/try' + encodeTryState(s));
	}

	function setTab(tab: TryState['tab']) {
		save({ tab });
	}

	async function start() {
		status = 'connecting';
		try {
			tools = await connect(endpoint());
			status = 'connected';
		} catch {
			status = 'failed';
		}
	}

	onMount(async () => {
		await start();
		const fromHash = decodeTryState(location.hash, tools.map((t: ToolInfo) => t.name));
		const wantsTools = new URLSearchParams(location.search).get('tab') === 'tools';
		tryState = location.hash ? fromHash : wantsTools ? { tab: 'tools' } : { tab: 'guided' };
	});
</script>

<svelte:head>
	<title>Try it · {SITE.name}</title>
	<meta
		name="description"
		content="Run OBS-TF MCP in the browser: walk through a story's session, or call any tool and see its exact answer."
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-10">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-medium text-ink">Try it</h1>
			<p class="mt-2 max-w-2xl text-sm text-ink-2">
				Everything here calls the live server below, the same way an assistant does. No key needed.
				The server allows a limited number of calls per minute.
			</p>
		</div>
		<div class="flex flex-col items-start gap-1 sm:items-end">
			<CopyPill value={endpoint()} label="Copy the server URL" />
			<p class="text-xs text-ink-2" aria-live="polite">
				{#if status === 'connected'}<span class="text-accent-2">●</span> Connected · {tools.length} tools
				{:else if status === 'connecting'}Connecting…
				{:else}<span class="text-danger">●</span> Not connected{/if}
			</p>
		</div>
	</div>

	<div class="mt-6 flex gap-1 border-b border-line" role="tablist">
		{#each [['guided', 'Guided session'], ['tools', 'Tools']] as [id, label]}
			<button
				type="button"
				role="tab"
				aria-selected={tryState.tab === id}
				onclick={() => setTab(id as TryState['tab'])}
				class="border-b-2 px-3 py-2 text-sm {tryState.tab === id
					? 'border-accent text-ink'
					: 'border-transparent text-ink-2 hover:text-ink'}">{label}</button
			>
		{/each}
	</div>

	<div class="mt-6">
		{#if status === 'failed'}
			<Callout tone="warn">
				Couldn't connect to the server. Check your connection and
				<button type="button" class="underline" onclick={start}>try again</button>.
			</Callout>
		{:else if status === 'connecting'}
			<p class="text-sm text-ink-2">Connecting to the server…</p>
		{:else if tryState.tab === 'guided'}
			<p class="mb-5 max-w-2xl text-sm text-ink-2">
				Pick a story and step through its session the way a group would, one part at a time.
			</p>
			<GuidedSession {tools} initial={tryState} onstate={save} />
		{:else}
			<p class="mb-5 max-w-2xl text-sm text-ink-2">
				Call any tool with your own arguments. The form comes from the tool’s schema.
			</p>
			{#key tryState.tool}
				<ToolRunner {tools} initial={tryState} onstate={save} />
			{/key}
		{/if}
	</div>
</div>
