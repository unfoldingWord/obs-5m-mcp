<script lang="ts">
	import { page } from '$app/state';
	import { SITE } from '$lib/site';

	let { children } = $props();
	const sections = [
		{ heading: 'Guide', items: [['/docs', 'Overview']] },
		{
			heading: 'Using the study manual',
			items: [
				['/docs/sessions', 'Sessions and parts'],
				['/docs/references', 'Stories and panels'],
				['/docs/questions-only', 'Questions only']
			]
		},
		{
			heading: 'Reference',
			items: [
				['/docs/sources', 'Sources and languages'],
				['/docs/limits', 'Limits and sizes'],
				['/docs/faq', 'FAQ'],
				['/tools', 'All tools']
			]
		}
	];
	const isCurrent = (href: string) => page.url.pathname === href;
</script>

<svelte:head><title>Docs · {SITE.name}</title></svelte:head>

<div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
	<nav aria-label="Docs" class="text-sm">
		{#each sections as s}
			<p class="mt-4 mb-1 text-xs text-accent-2 first:mt-0">{s.heading}</p>
			<ul>
				{#each s.items as [href, label]}
					<li>
						<a
							{href}
							aria-current={isCurrent(href) ? 'page' : undefined}
							class="block rounded px-2 py-1 {isCurrent(href) ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'}"
							>{label}</a
						>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>
	<article class="docs min-w-0 max-w-3xl">
		{@render children()}
	</article>
</div>

<style>
	.docs :global(h1) {
		font-size: 1.875rem;
		font-weight: 500;
		color: var(--text);
	}
	.docs :global(h2) {
		margin-top: 2.25rem;
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text);
	}
	.docs :global(p),
	.docs :global(li) {
		color: var(--text-2);
	}
	.docs :global(p) {
		margin-top: 0.75rem;
	}
	.docs :global(ul.list) {
		margin-top: 0.75rem;
		padding-left: 1.2rem;
		list-style: disc;
	}
	.docs :global(li) {
		margin-top: 0.3rem;
	}
	.docs :global(code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
		color: var(--text);
	}
	.docs :global(a) {
		color: var(--accent);
	}
	.docs :global(table) {
		margin-top: 1rem;
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}
	.docs :global(th),
	.docs :global(td) {
		border-bottom: 1px solid var(--border);
		padding: 0.5rem 0.75rem 0.5rem 0;
		text-align: left;
		vertical-align: top;
		color: var(--text-2);
	}
	.docs :global(th) {
		font-weight: 400;
		font-size: 0.75rem;
	}
	.docs :global(.table-wrap) {
		overflow-x: auto;
	}
</style>
