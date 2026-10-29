<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight } from 'lucide-svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { ANATOMY_PARTS, type AnatomyPart } from './parts';
	import snapshot from './snapshot.json';
	import { endpoint } from '$lib/endpoint.svelte';
	import { connect, hasParam, run } from '$lib/mcp/session';
	import type { ToolInfo } from '$lib/mcp/client';
	import { encodeTryState } from '$lib/try/hashState';
	import { revealOnNarrow } from '$lib/reveal';
	import { ART_CREDIT, panelSrc } from '$lib/obs/storyboard';

	/** Story 1 panels that picture a part; the others are text only. */
	const ART: Partial<Record<string, string>> = { intro: '01-02', frames: '01-05', movement1: '01-05' };

	const saved = snapshot as Record<string, string>;
	let selected = $state<AnatomyPart>(ANATOMY_PARTS[3]);
	let tools = $state<ToolInfo[] | null>(null);
	let live = $state<Record<string, string>>({});
	let connectFailedThisVisit = false;
	let mounted = $state(false);

	/** The call to show and share: keep include_answers until the connected server's schema lacks it. */
	const shownCall = $derived.by(() => shownCallFor(selected));
	const callText = $derived(`fetch_obs_study_manual ${JSON.stringify(shownCall)}`);
	const tryHref = $derived(
		'/try' + encodeTryState({ tab: 'tools', tool: 'fetch_obs_study_manual', args: shownCall })
	);
	const excerpt = $derived(live[selected.part] ?? saved[selected.part] ?? '');
	const isLive = $derived(selected.part in live);

	async function load(p: AnatomyPart) {
		if (live[p.part] || connectFailedThisVisit) return;
		let knownTools = tools;
		if (!knownTools) {
			try {
				knownTools = await connect(endpoint());
				tools = knownTools;
			} catch {
				connectFailedThisVisit = true;
				return;
			}
		}

		const supportsAnswersForPart = hasParam(knownTools, 'fetch_obs_study_manual', 'include_answers');
		// An example without answers needs a server that can leave them out.
		if (p.call.include_answers === false && !supportsAnswersForPart) return;
		const { result, outcome } = await run(endpoint(), 'fetch_obs_study_manual', {
			...shownCallFor(p, knownTools),
			language: 'en',
			format: 'md'
		});
		const content = result?.structured?.content;
		if (outcome.kind === 'ok' && typeof content === 'string') {
			live = { ...live, [p.part]: trim(content) };
		}
	}

	function shownCallFor(p: AnatomyPart, knownTools: ToolInfo[] | null = tools) {
		const includeAnswersSupported = knownTools
			? hasParam(knownTools, 'fetch_obs_study_manual', 'include_answers')
			: true;
		const { include_answers, ...rest } = p.call;
		return includeAnswersSupported && include_answers === false ? p.call : rest;
	}

	function trim(md: string): string {
		const body = md
			.split('\n')
			.filter((l) => !/^# /.test(l) && !/^\*Session part:/.test(l))
			.join('\n')
			.trim();
		if (body.length <= 600) return body;
		const cut = body.lastIndexOf('\n', 600);
		return body.slice(0, cut > 300 ? cut : 600).trimEnd() + '\n\n…';
	}

	let card = $state<HTMLElement>();

	function choose(p: AnatomyPart) {
		selected = p;
		void load(p);
		revealOnNarrow(card);
	}

	onMount(() => {
		mounted = true;
	});
</script>

<div class="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
	<div class="md:hidden">
		<label for="a-part" class="text-xs text-ink-2">Part of the story</label>
		<select
			id="a-part"
			class="w-full rounded-md border border-line-strong bg-bg px-2.5 py-2 text-sm text-ink"
			value={selected.part}
			onchange={(e) => {
				const p = ANATOMY_PARTS.find((x) => x.part === e.currentTarget.value);
				if (p) choose(p);
			}}
		>
			{#each ANATOMY_PARTS as p (p.part)}
				<option value={p.part}>{p.group === 'movements' ? p.title.split(':')[0] : p.title}</option>
			{/each}
		</select>
	</div>
	<ol class="hidden space-y-1 md:block" aria-label="Parts of a story">
		{#each ANATOMY_PARTS as p, i (p.part)}
			{#if i === 3}
				<li class="pt-3 pb-1 text-xs text-accent-2">Five Movements</li>
			{/if}
			{#if i === 8}
				<li class="pt-3"></li>
			{/if}
			<li>
				<button
					type="button"
					onclick={() => choose(p)}
					aria-current={selected.part === p.part}
					class="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors {selected.part ===
					p.part
						? 'border-accent bg-surface text-ink'
						: 'border-transparent text-ink-2 hover:border-line hover:text-ink'}"
				>
					{#if p.group === 'movements'}
						<span class="mr-1 font-mono text-xs text-accent-2">{i - 2}</span>
					{/if}
					{p.group === 'movements' ? p.title.split(':')[0] : p.title}
				</button>
			</li>
		{/each}
	</ol>

	<article class="min-w-0 scroll-mt-20 rounded-md bg-surface p-5 sm:p-6" bind:this={card} data-anatomy-card>
		{#if ART[selected.part]}
			<figure class="mb-5">
				<img
					src={panelSrc(ART[selected.part]!)}
					alt="Open Bible Stories panel {ART[selected.part]}"
					width="560"
					height="315"
					loading="lazy"
					class="aspect-[16/9] w-full rounded-md object-cover sm:max-w-md"
				/>
				<figcaption class="mt-1.5 text-xs text-ink-2">
					Panel {ART[selected.part]} · {ART_CREDIT.text}
				</figcaption>
			</figure>
		{/if}
		<h3 class="text-xl font-semibold text-ink">{selected.title}</h3>
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each selected.contains as c}
				<li class="rounded border border-line-strong px-2 py-0.5 text-xs text-ink-2">{c}</li>
			{/each}
		</ul>

		<div class="mt-5 rounded-md bg-bg p-4" data-anatomy-excerpt>
			<p class="mb-2 font-mono text-[11px] text-accent-2">
				{isLive ? 'Live from the server · story 1' : 'Saved example · story 1'}
			</p>
			{#if mounted}
				<Markdown source={excerpt} />
			{:else}
				<pre class="font-mono text-xs whitespace-pre-wrap text-ink-2">{excerpt}</pre>
			{/if}
		</div>

		<dl class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 text-sm">
			<div>
				<dt class="text-xs text-ink-2">A person asks</dt>
				<dd class="mt-0.5 text-ink">“{selected.ask}”</dd>
			</div>
			<div>
				<dt class="text-xs text-ink-2">The assistant calls</dt>
				<dd class="mt-0.5 overflow-x-auto font-mono text-[13px] text-ink">{callText}</dd>
			</div>
		</dl>
		<a href={tryHref} class="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
			>Run this call <ArrowRight size={14} /></a
		>
	</article>
</div>
