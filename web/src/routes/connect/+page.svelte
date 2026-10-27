<script lang="ts">
	import CodeTabs from '$lib/components/CodeTabs.svelte';
	import CopyPill from '$lib/components/CopyPill.svelte';
	import Button from '$lib/components/Button.svelte';
	import { CLIENTS } from '$lib/connect/clients';
	import { endpoint } from '$lib/endpoint.svelte';
	import { SITE } from '$lib/site';

	const clients = $derived(CLIENTS(endpoint()));
	let active = $state('claude-code');
	const current = $derived(clients.find((c) => c.id === active) ?? clients[0]);

	const troubles = [
		[
			'The client says it cannot connect',
			'This server speaks MCP over Streamable HTTP at the URL above. It has no SSE-only endpoint. Clients that only start local programs need mcp-remote (see Other clients).'
		],
		[
			'The server never shows up, and there is no error',
			'Check the key name in your config file. Cursor and Claude Desktop read "mcpServers", VS Code reads "servers", and a server under the wrong key is skipped without a warning. Some clients also expect "url" where others expect "serverUrl".'
		],
		[
			'Requests from curl or a script fail',
			'Send both content types in the Accept header: application/json, text/event-stream.'
		],
		[
			'“Too many requests”',
			'The server allows a limited number of calls per minute from one address. Wait a minute and try again.'
		],
		[
			'An answer says the content is not available',
			'That language has no content for that story yet. It is an answer, not an error: try English, or another story.'
		]
	];
</script>

<svelte:head>
	<title>Connect · {SITE.name}</title>
	<meta
		name="description"
		content="Add OBS-TF MCP to Claude, Cursor, VS Code, Codex or any MCP client. No key needed."
	/>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-14">
	<h1 class="text-3xl font-medium text-ink">Connect your assistant</h1>
	<p class="mt-3 max-w-2xl text-ink-2">
		The server has one URL and needs no key or account. Add it to your client, then ask about a
		story.
	</p>
	<div class="mt-6"><CopyPill value={endpoint()} label="Copy the server URL" /></div>

	<div class="mt-10 grid gap-8 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
		<nav aria-label="Clients">
			<ul class="flex gap-1 overflow-x-auto md:flex-col">
				{#each clients as c (c.id)}
					<li class="shrink-0">
						<button
							type="button"
							onclick={() => (active = c.id)}
							aria-current={active === c.id}
							class="w-full rounded-md px-3 py-1.5 text-left text-sm {active === c.id
								? 'bg-surface text-ink'
								: 'text-ink-2 hover:text-ink'}">{c.label}</button
						>
					</li>
				{/each}
			</ul>
		</nav>

		<section class="min-w-0" aria-live="polite">
			<h2 class="text-xl font-medium text-ink">{current.label}</h2>
			<p class="mt-2 text-ink-2">{current.steps}</p>
			{#if current.install}
				<div class="mt-4"><Button variant="primary" href={current.install.href}>{current.install.label}</Button></div>
			{/if}
			{#if current.tabs.length}
				<div class="mt-5">{#key current.id}<CodeTabs tabs={current.tabs} />{/key}</div>
			{/if}
			<p class="mt-5 text-sm text-ink-2">
				Then ask, for example: “Show me the observation questions for story 1, panel 5.”
				<a class="text-accent hover:underline" href="/try">Or try it here first.</a>
			</p>
		</section>
	</div>

	<section class="mt-16" aria-labelledby="trouble">
		<h2 id="trouble" class="text-xl font-medium text-ink">Troubleshooting</h2>
		<div class="mt-4 divide-y divide-line rounded-lg border border-line">
			{#each troubles as [q, a]}
				<details class="group p-4">
					<summary class="cursor-pointer text-ink">{q}</summary>
					<p class="mt-2 text-sm text-ink-2">{a}</p>
				</details>
			{/each}
		</div>
	</section>
</div>
