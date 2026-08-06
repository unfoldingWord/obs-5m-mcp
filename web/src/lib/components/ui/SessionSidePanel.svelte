<script lang="ts">
	/**
	 * OBS session panel — replaces TH ResourceSidePanel (scripture/TN/TW)
	 * with Five Movements sessionFlow navigation.
	 */
	import { createEventDispatcher } from 'svelte';
	import X from 'lucide-svelte/icons/x';

	export let story = 1;
	export let language = 'en';
	export let mode = 'study';
	export let activePart: string | null = null;
	export let open = true;

	const dispatch = createEventDispatcher<{
		close: void;
		selectPart: string;
		selectStory: number;
	}>();

	const FLOW: Array<{ part: string; label: string; mode: string }> = [
		{ part: 'intro', label: 'Introduction', mode: 'study' },
		{ part: 'frames', label: 'Story frames', mode: 'study' },
		{ part: 'community', label: 'Community Study', mode: 'study' },
		{ part: 'movement1', label: '1 · Observe / Translate', mode: 'study' },
		{ part: 'movement2', label: '2 · Discuss', mode: 'study' },
		{ part: 'drafting', label: 'Drafting', mode: 'translate' },
		{ part: 'movement3', label: '3 · Journal', mode: 'translate' },
		{ part: 'checking', label: 'Team check', mode: 'check' },
		{ part: 'movement4', label: '4 · Ministry', mode: 'check' },
		{ part: 'movement5', label: '5 · Mission', mode: 'check' },
		{ part: 'conclusion', label: 'Conclusion', mode: 'check' }
	];
</script>

<aside
	class="flex h-full min-h-0 w-full flex-col border-l border-slate-800 bg-slate-950"
	class:hidden={!open}
>
	<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
		<div class="min-w-0 flex-1">
			<div class="text-xs font-semibold tracking-wide text-slate-200 uppercase">OBS session</div>
			<div class="truncate text-[11px] text-slate-500">
				Story {story} · {language.toUpperCase()} · {mode}
			</div>
		</div>
		<button
			type="button"
			class="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden"
			on:click={() => dispatch('close')}
			aria-label="Close session panel"
		>
			<X size={16} />
		</button>
	</div>

	<div class="border-b border-slate-800 px-3 py-2">
		<label class="mb-1 block text-[10px] font-medium text-slate-500 uppercase" for="obs-story"
			>Story</label
		>
		<select
			id="obs-story"
			class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
			value={story}
			on:change={(e) => dispatch('selectStory', Number(e.currentTarget.value))}
		>
			{#each Array.from({ length: 50 }, (_, i) => i + 1) as n}
				<option value={n}>OBS {n}</option>
			{/each}
		</select>
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Session flow">
		{#each FLOW as step}
			<button
				type="button"
				class="mb-0.5 flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs transition-colors
					{activePart === step.part
					? 'bg-sky-950 text-sky-100 ring-1 ring-sky-700/60'
					: 'text-slate-300 hover:bg-slate-900'}"
				on:click={() => dispatch('selectPart', step.part)}
			>
				<span class="truncate">{step.label}</span>
			</button>
		{/each}
	</nav>

	<p class="border-t border-slate-800 px-3 py-2 text-[10px] leading-snug text-slate-500">
		Five Movements: observe → discuss → reflect → serve → share (plus draft/check). Formation, not
		info dump. Parts via <code class="text-slate-400">fetch_obs_study_manual</code>.
	</p>
</aside>
