<script lang="ts">
	import type { Field } from '$lib/try/fields';

	let {
		fields,
		values = $bindable({}),
		onrun
	}: { fields: Field[]; values?: Record<string, unknown>; onrun: () => void } = $props();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onrun();
	}
	const input =
		'w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-2';
	const unset = (f: Field) => (f.default !== undefined ? `Default (${f.default})` : 'Not set');
</script>

<form class="space-y-3" onsubmit={submit}>
	{#each fields as f (f.key)}
		<div>
			<label for="f-{f.key}" class="flex items-baseline gap-2 text-sm text-ink">
				<span class="font-mono text-[13px]">{f.key}</span>
				{#if f.required}<span class="text-xs text-accent-2">required</span>{/if}
			</label>
			{#if f.description}<p class="mb-1 text-xs text-ink-2">{f.description}</p>{/if}
			{#if f.kind === 'select'}
				<select id="f-{f.key}" class={input} bind:value={values[f.key]}>
					<option value="">{unset(f)}</option>
					{#each f.options ?? [] as o}<option value={o}>{o}</option>{/each}
				</select>
			{:else if f.kind === 'switch'}
				<select id="f-{f.key}" class={input} bind:value={values[f.key]}>
					<option value="">{unset(f)}</option>
					<option value={true}>true</option>
					<option value={false}>false</option>
				</select>
			{:else if f.kind === 'number'}
				<input
					id="f-{f.key}"
					type="number"
					class={input}
					min={f.min}
					max={f.max}
					placeholder={f.default !== undefined ? String(f.default) : ''}
					bind:value={values[f.key]}
				/>
			{:else}
				<input
					id="f-{f.key}"
					type="text"
					class={input}
					required={f.required}
					placeholder={f.default !== undefined ? String(f.default) : ''}
					bind:value={values[f.key]}
				/>
			{/if}
		</div>
	{/each}
	<button type="submit" class="rounded-md bg-accent px-3.5 py-2 text-sm text-on-accent hover:opacity-90"
		>Run</button
	>
</form>
