<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import ResultViewer from '$lib/components/ResultViewer.svelte';
	import { endpoint } from '$lib/endpoint.svelte';
	import { hasParam, run, type RunResult } from '$lib/mcp/session';
	import type { ToolInfo } from '$lib/mcp/client';
	import type { TryState } from './hashState';
	import { validPanels } from './panels';

	let {
		tools,
		initial,
		onstate
	}: { tools: ToolInfo[]; initial: TryState; onstate: (s: TryState) => void } = $props();

	// The server's own order (sessionFlow in src/content/studyManual.ts); replaced by
	// the sessionFlow each answer carries.
	let flow = $state([
		'intro',
		'frames',
		'community',
		'movement1',
		'movement2',
		'drafting',
		'movement3',
		'checking',
		'movement4',
		'movement5',
		'conclusion'
	]);
	const LABELS: Record<string, string> = {
		intro: 'Introduction',
		frames: 'The story',
		community: 'Community study',
		movement1: 'Movement 1 · Biblical Interpretation',
		movement2: 'Movement 2 · Theological Dialogue',
		drafting: 'Translation draft',
		movement3: 'Movement 3 · Personal Reflection',
		checking: 'Team check',
		movement4: 'Movement 4 · Ministry Practice',
		movement5: 'Movement 5 · Missional Outreach',
		conclusion: 'Conclusion'
	};

	const init = untrack(() => initial);
	const firstStep = untrack(() => Math.max(0, flow.indexOf(init.part ?? 'intro')));
	let languages = $state<{ code: string; name: string }[]>([]);
	let stories = $state<{ story: number; title: string; collection?: string }[]>([]);
	let lang = $state(init.lang ?? 'en');
	let story = $state(init.story ?? 1);
	let range = $state('');
	let view = $state<'leader' | 'community'>(init.view ?? 'leader');
	let step = $state(firstStep);
	let pending = $state(false);
	let answer = $state<RunResult | null>(null);

	const canChooseView = $derived(hasParam(tools, 'fetch_obs_study_manual', 'include_answers'));
	const part = $derived(flow[step] ?? 'intro');
	const reference = $derived(range.trim() ? `${story}:${range.trim()}` : String(story));
	// Ranges arrived with include_answers (unfoldingWord/obs-5m-mcp#18); older servers read only the first panel.
	const supportsRanges = $derived(canChooseView);
	const rangeOk = $derived(validPanels(range, supportsRanges));

	// Calls can finish after the tab changes; a closed session must not report state.
	let alive = true;
	onDestroy(() => (alive = false));

	async function loadStories() {
		const { result } = await run(endpoint(), 'list_stories', { language: lang });
		if (!alive) return;
		const list = result?.structured?.stories;
		stories = Array.isArray(list) ? (list as typeof stories) : [];
		if (stories.length && !stories.some((s) => s.story === story)) story = stories[0].story;
	}

	async function show() {
		if (!rangeOk) return;
		pending = true;
		const args: Record<string, unknown> = { reference, part, language: lang, format: 'md' };
		if (canChooseView && view === 'community') args.include_answers = false;
		const next = await run(endpoint(), 'fetch_obs_study_manual', args);
		if (!alive) return;
		answer = next;
		const sf = answer.result?.structured?.sessionFlow;
		if (Array.isArray(sf) && sf.length && sf.every((x) => typeof x === 'string')) {
			const current = part;
			flow = sf as string[];
			step = Math.max(0, flow.indexOf(current));
		}
		pending = false;
		onstate({ tab: 'guided', lang, story, part, ...(canChooseView ? { view } : {}) });
	}

	function go(delta: number) {
		step = Math.min(flow.length - 1, Math.max(0, step + delta));
		void show();
	}

	onMount(async () => {
		const { result } = await run(endpoint(), 'list_languages', {});
		if (!alive) return;
		const list = result?.structured?.languages;
		languages = Array.isArray(list) ? (list as typeof languages) : [{ code: 'en', name: 'English' }];
		await loadStories();
		if (alive) await show();
	});

	const control =
		'w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 text-sm text-ink';
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
	<aside class="space-y-4">
		<div>
			<label for="g-lang" class="text-xs text-ink-2">Language</label>
			<select
				id="g-lang"
				class={control}
				bind:value={lang}
				onchange={async () => {
					await loadStories();
					await show();
				}}
			>
				{#each languages as l}<option value={l.code}>{l.name} ({l.code})</option>{/each}
			</select>
		</div>
		<div>
			<label for="g-story" class="text-xs text-ink-2">Story</label>
			<select id="g-story" class={control} bind:value={story} onchange={show}>
				{#each stories as s}<option value={s.story}>{s.story}. {s.title}</option>{/each}
			</select>
		</div>
		<div>
			<label for="g-range" class="text-xs text-ink-2">Panels (optional)</label>
			<input
				id="g-range"
				class={control}
				placeholder={supportsRanges ? '5 or 5-8' : '5'}
				bind:value={range}
				onchange={show}
				aria-invalid={!rangeOk}
			/>
			{#if !rangeOk}
				<p class="mt-1 text-xs text-danger">
					{supportsRanges ? 'Enter a panel number or a range like 5-8.' : 'Enter one panel number.'}
				</p>
			{/if}
		</div>
		{#if canChooseView}
			<fieldset>
				<legend class="text-xs text-ink-2">View</legend>
				<div class="mt-1 grid grid-cols-2 gap-1 rounded-md border border-line-strong p-1">
					{#each [['leader', 'Leader view'], ['community', 'Community view']] as [id, label]}
						<button
							type="button"
							aria-pressed={view === id}
							onclick={() => {
								view = id as 'leader' | 'community';
								void show();
							}}
							class="rounded px-2 py-1 text-xs {view === id ? 'bg-accent text-on-accent' : 'text-ink-2 hover:text-ink'}"
							>{label}</button
						>
					{/each}
				</div>
				<p class="mt-1 text-xs text-ink-2">
					{view === 'leader'
						? 'With the manual’s answers, to prepare and guide.'
						: 'Questions only, what the group works through.'}
				</p>
			</fieldset>
		{/if}
		<ol class="space-y-0.5 border-t border-line pt-4" aria-label="Session parts">
			{#each flow as p, i}
				<li>
					<button
						type="button"
						onclick={() => {
							step = i;
							void show();
						}}
						aria-current={i === step ? 'step' : undefined}
						class="w-full rounded px-2 py-1 text-left text-sm {i === step
							? 'bg-surface text-ink'
							: 'text-ink-2 hover:text-ink'}">{LABELS[p] ?? p}</button
					>
				</li>
			{/each}
		</ol>
	</aside>

	<div class="min-w-0 space-y-3">
		<div class="flex items-center justify-between gap-3">
			<h2 class="font-medium text-ink">{LABELS[part] ?? part}</h2>
			<div class="flex gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md border border-line-strong px-2.5 py-1 text-sm text-ink disabled:opacity-40"
					onclick={() => go(-1)}
					disabled={step === 0}><ArrowLeft size={14} /> Back</button
				>
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-sm text-on-accent disabled:opacity-40"
					onclick={() => go(1)}
					disabled={step === flow.length - 1}>Next <ArrowRight size={14} /></button
				>
			</div>
		</div>
		<ResultViewer
			tool="fetch_obs_study_manual"
			result={answer?.result ?? null}
			outcome={answer?.outcome ?? null}
			{pending}
			onretry={show}
		/>
	</div>
</div>
