<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import { fieldsFromSchema } from '$lib/try/fields';
	import { encodeTryState } from '$lib/try/hashState';
	import { SITE } from '$lib/site';
	import type { ToolGroup } from '$lib/catalog';

	let { data } = $props();

	const GROUPS: [ToolGroup, string, string][] = [
		['primary', 'Study manual', 'The tool most assistants need: any part of any story.'],
		['discovery', 'Discovery', 'What exists: languages, units, stories and the session structure.'],
		['helpers', 'Helpers', 'Focused reads, search, and the Indonesian PDF download.']
	];
	const typeOf = (schema: Record<string, unknown>, key: string): string => {
		const p = ((schema.properties ?? {}) as Record<string, Record<string, unknown>>)[key] ?? {};
		if (Array.isArray(p.enum)) return 'enum';
		if (Array.isArray(p.type)) return (p.type as string[]).join(' | ');
		if (p.type) return String(p.type);
		if (Array.isArray(p.anyOf)) {
			return (p.anyOf as Record<string, unknown>[]).map((x) => String(x.type)).join(' | ');
		}
		return 'any';
	};
</script>

<svelte:head>
	<title>Tools · {SITE.name}</title>
	<meta name="description" content="Every tool OBS-TF MCP offers, with its parameters." />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-14">
	<h1 class="text-3xl font-bold tracking-tight text-ink">Tools</h1>
	<p class="mt-3 max-w-2xl text-ink-2">
		{data.tools.length} read-only tools. This page is generated from the server’s own tool list, so it
		always matches what the server accepts.
	</p>

	{#each GROUPS as [group, heading, line]}
		<section class="mt-12" aria-labelledby="g-{group}">
			<h2 id="g-{group}" class="text-xl font-semibold text-ink">{heading}</h2>
			<p class="mt-1 text-sm text-ink-2">{line}</p>
			<div class="mt-5 space-y-4">
				{#each data.tools.filter((t) => t.group === group) as tool (tool.name)}
					{@const fields = fieldsFromSchema(tool.inputSchema)}
					<article id={tool.name} class="rounded-lg border border-line bg-surface p-5">
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
							<h3 class="font-mono text-base text-ink">{tool.name}</h3>
							{#if tool.readOnly}
								<span class="rounded border border-line-strong px-1.5 text-xs text-ink-2">read-only</span>
							{/if}
							<a
								class="ml-auto inline-flex items-center gap-1 text-sm text-accent hover:underline"
								href={'/try' + encodeTryState({ tab: 'tools', tool: tool.name })}
								>Try <ArrowRight size={14} /></a
							>
						</div>
						<p class="mt-2 text-sm text-ink-2">{tool.description}</p>

						{#if fields.length}
							<div class="mt-4 overflow-x-auto">
								<table class="w-full min-w-[32rem] text-left text-sm">
									<thead class="text-xs text-ink-2">
										<tr class="border-b border-line">
											<th class="py-2 pr-4 font-normal">Parameter</th>
											<th class="py-2 pr-4 font-normal">Type</th>
											<th class="py-2 pr-4 font-normal">Required</th>
											<th class="py-2 font-normal">Description</th>
										</tr>
									</thead>
									<tbody>
										{#each fields as f}
											<tr class="border-b border-line align-top last:border-0">
												<td class="py-2 pr-4 font-mono text-[13px] text-ink">{f.key}</td>
												<td class="py-2 pr-4 font-mono text-xs text-ink-2">
													{typeOf(tool.inputSchema, f.key)}
													{#if f.options}<span class="block">{f.options.join(' · ')}</span>{/if}
												</td>
												<td class="py-2 pr-4 text-xs text-ink-2">{f.required ? 'yes' : 'no'}</td>
												<td class="py-2 text-xs text-ink-2">
													{f.description ?? ''}
													{#if f.default !== undefined}<span class="block">Default: {String(f.default)}</span>{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="mt-3 text-xs text-ink-2">No parameters.</p>
						{/if}

						<details class="mt-3">
							<summary class="cursor-pointer text-xs text-ink-2 hover:text-ink">JSON Schema</summary>
							<pre class="mt-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-xs text-ink">{JSON.stringify(
									tool.inputSchema,
									null,
									2
								)}</pre>
						</details>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</div>
