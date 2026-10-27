<script lang="ts">
	import { page } from '$app/state';
	import { Menu, X } from 'lucide-svelte';
	import { SITE, nav } from '$lib/site';
	import ThemeToggle from './ThemeToggle.svelte';

	let open = $state(false);
	const current = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<header class="sticky top-0 z-20 border-b border-line bg-bg">
	<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
		<!-- Product type first, so the site never reads as the official OBS site. -->
		<a href="/" class="flex min-w-0 items-center gap-2.5 text-ink" aria-label={SITE.fullName}>
			<img src="/favicon.svg" alt="" class="h-7 w-7 shrink-0" />
			<span class="flex min-w-0 flex-col leading-tight">
				<span class="text-[15px] font-bold tracking-tight">MCP Server</span>
				<span class="truncate text-xs text-ink-2">
					<span class="md:hidden">OBS + Theological Formation</span>
					<span class="hidden md:inline">Open Bible Stories + Theological Formation</span>
				</span>
			</span>
		</a>
		<nav class="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
			{#each nav.slice(1) as item}
				<a
					href={item.href}
					class="rounded-md px-3 py-1.5 text-sm hover:text-ink {current(item.href) ? 'text-ink' : 'text-ink-2'}"
					aria-current={current(item.href) ? 'page' : undefined}>{item.label}</a
				>
			{/each}
			<a href={SITE.repo} class="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:text-ink">GitHub</a>
		</nav>
		<div class="ml-auto flex items-center gap-2 md:ml-2">
			<ThemeToggle />
			<a href="/try" class="hidden rounded-md bg-accent px-3 py-1.5 text-sm text-on-accent hover:opacity-90 sm:inline-block"
				>Try it</a
			>
			<button
				type="button"
				class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 md:hidden"
				aria-label={open ? 'Close menu' : 'Open menu'}
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				{#if open}<X size={16} />{:else}<Menu size={16} />{/if}
			</button>
		</div>
	</div>
	{#if open}
		<nav class="border-t border-line px-4 py-2 md:hidden" aria-label="Main">
			{#each nav as item}
				<a href={item.href} class="block py-2 text-ink" onclick={() => (open = false)}>{item.label}</a>
			{/each}
			<a href={SITE.repo} class="block py-2 text-ink">GitHub</a>
		</nav>
	{/if}
</header>
