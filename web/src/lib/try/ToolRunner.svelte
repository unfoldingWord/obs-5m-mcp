<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import ResultViewer from '$lib/components/ResultViewer.svelte';
	import ToolForm from '$lib/components/ToolForm.svelte';
	import CodeTabs from '$lib/components/CodeTabs.svelte';
	import { endpoint } from '$lib/endpoint.svelte';
	import { hasParam, run, type RunResult } from '$lib/mcp/session';
	import type { ToolInfo } from '$lib/mcp/client';
	import { argsFromValues, fieldsFromSchema } from './fields';
	import { PRESETS, type Preset } from './presets';
	import { curlFor, inspectorFor } from './copyAs';
	import type { TryState } from './hashState';
	import { revealOnNarrow } from '$lib/reveal';

	let {
		tools,
		initial,
		onstate
	}: { tools: ToolInfo[]; initial: TryState; onstate: (s: TryState) => void } = $props();

	const init = untrack(() => ({ ...initial, known: tools.map((t) => t.name) }));
	let selected = $state(
		init.tool && init.known.includes(init.tool) ? init.tool : 'fetch_obs_study_manual'
	);
	let values = $state<Record<string, unknown>>({ ...(init.args ?? {}) });
	let pending = $state(false);
	let answer = $state<RunResult | null>(null);
	let lastArgs = $state<Record<string, unknown>>({});

	const tool = $derived(tools.find((t) => t.name === selected));
	const fields = $derived(tool ? fieldsFromSchema(tool.inputSchema) : []);
	const presets = $derived(
		PRESETS.filter((p) => tools.some((t) => t.name === p.tool) && (!p.needs || hasParam(tools, p.tool, p.needs)))
	);

	// A call can finish after the tab changes; a closed runner must not report state.
	let alive = true;
	onDestroy(() => (alive = false));

	function choose(name: string) {
		selected = name;
		values = {};
		answer = null;
		onstate({ tab: 'tools', tool: name });
	}

	let resultEl = $state<HTMLElement>();

	/** Run because the person asked: on a phone, scroll to the answer. */
	async function runAndReveal() {
		void exec();
		// Let the form and result settle first (an example can switch the tool).
		await tick();
		revealOnNarrow(resultEl);
	}

	async function exec() {
		const args = argsFromValues(fields, values);
		lastArgs = args;
		pending = true;
		const next = await run(endpoint(), selected, args);
		if (!alive) return;
		answer = next;
		pending = false;
		onstate({ tab: 'tools', tool: selected, args });
	}

	function usePreset(p: Preset) {
		selected = p.tool;
		values = { ...p.args };
		runAndReveal();
	}

	// A shared link with arguments runs right away.
	if (init.tool && init.args) void exec();
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,20rem)_minmax(0,1fr)]">
	<nav aria-label="Tools">
		<div class="lg:hidden">
			<label for="t-tool" class="text-xs text-ink-2">Tool</label>
			<select
				id="t-tool"
				class="w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 font-mono text-[13px] text-ink"
				value={selected}
				onchange={(e) => choose(e.currentTarget.value)}
			>
				{#each tools as t (t.name)}<option value={t.name}>{t.name}</option>{/each}
			</select>
		</div>
		<p class="mb-2 hidden text-xs text-ink-2 lg:block">Tools</p>
		<ul class="hidden space-y-0.5 lg:block">
			{#each tools as t (t.name)}
				<li>
					<button
						type="button"
						onclick={() => choose(t.name)}
						aria-current={t.name === selected}
						class="w-full truncate rounded px-2 py-1 text-left font-mono text-[13px] {t.name === selected
							? 'bg-surface text-ink'
							: 'text-ink-2 hover:text-ink'}">{t.name}</button
					>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="min-w-0 space-y-5">
		{#if presets.length}
			<div>
				<p class="mb-2 text-xs text-ink-2">Examples</p>
				<div class="flex flex-wrap gap-1.5">
					{#each presets as p}
						<button
							type="button"
							class="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-2 hover:text-ink"
							onclick={() => usePreset(p)}>{p.label}</button
						>
					{/each}
				</div>
			</div>
		{/if}
		{#if tool}
			<div>
				<h2 class="font-mono text-sm text-ink">{tool.name}</h2>
				<p class="mt-1 text-xs text-ink-2">{tool.description}</p>
			</div>
			{#key selected}
				<ToolForm {fields} bind:values onrun={runAndReveal} />
			{/key}
		{/if}
	</div>

	<div class="min-w-0 space-y-4">
		<div class="scroll-mt-20" bind:this={resultEl} data-result>
		<ResultViewer tool={selected} result={answer?.result ?? null} outcome={answer?.outcome ?? null} {pending} onretry={exec} />
		</div>
		{#if answer?.result}
			<div>
				<p class="mb-2 text-xs text-ink-2">The same call outside the browser</p>
				<CodeTabs
					tabs={[
						{ label: 'curl', code: curlFor(endpoint(), selected, lastArgs) },
						{ label: 'MCP Inspector', code: inspectorFor(endpoint(), selected, lastArgs) }
					]}
				/>
			</div>
		{/if}
	</div>
</div>
