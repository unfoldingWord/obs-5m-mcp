<script lang="ts">
	import { ArrowRight, BookOpen, Languages, Quote, Rows3 } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import CopyPill from '$lib/components/CopyPill.svelte';
	import AnatomyExplorer from '$lib/anatomy/AnatomyExplorer.svelte';
	import { SITE } from '$lib/site';
	import { endpoint } from '$lib/endpoint.svelte';
	import { cursorDeeplink } from '$lib/connect/clients';
	import { HOME_EXAMPLES } from '$lib/home/examples';
	import { encodeTryState } from '$lib/try/hashState';

	const offers = [
		{
			icon: Rows3,
			title: 'A whole story, or one part of it',
			text: 'Get the full session in order, or only the part your group is on: the introduction, the story panels, the community study, one movement, the drafting or checking step, or the conclusion.'
		},
		{
			icon: BookOpen,
			title: 'Down to a single panel',
			text: 'Ask for panel 5 of story 1 and get the questions for that panel only, not the whole story.'
		},
		{
			icon: Quote,
			title: 'The manual’s own words',
			text: 'Every answer is the published text, not a summary, so an assistant can quote the questions exactly as written.'
		},
		{
			icon: Languages,
			title: 'English and Indonesian',
			text: 'Content comes from the Door43 catalog. A language that has no content for a story gets a clear “not available” answer.'
		}
	];

	const movements = [
		['Biblical Interpretation', 'Observing the details of the story'],
		['Theological Dialogue', 'Discussing the meaning of the story'],
		['Personal Reflection', 'Following the teaching of the story'],
		['Ministry Practice', 'Serving the church with the story'],
		['Missional Outreach', 'Sharing the truth of the story']
	];

	const clients = ['Claude', 'Cursor', 'VS Code', 'Codex', 'BT Servant'];
	const exampleHref = (tool: string, args: Record<string, unknown>) =>
		'/try' + encodeTryState({ tab: 'tools', tool, args });
</script>

<svelte:head>
	<title>{SITE.name} · Open Bible Stories + Theological Formation over MCP</title>
	<meta
		name="description"
		content="A read-only MCP server that gives AI assistants the Open Bible Stories + Theological Formation study manual from Door43. No key or sign-up."
	/>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24">
	<p class="font-mono text-xs text-accent-2">MCP server · Open Bible Stories + Theological Formation</p>
	<h1 class="mt-4 max-w-3xl text-3xl leading-tight font-medium text-ink sm:text-5xl sm:leading-[1.1]">
		Fifty Bible stories and the Five Movements, word for word, for your AI assistant.
	</h1>
	<p class="mt-5 max-w-2xl text-base text-ink-2 sm:text-lg">
		Connect Claude, Cursor or BT Servant to the OBS + Theological Formation study manual. Ask for a
		story, a movement or a single panel, and get the manual’s own words from Door43.
	</p>
	<div class="mt-8 flex flex-wrap items-center gap-3">
		<CopyPill value={endpoint()} label="Copy the server URL" />
		<Button variant="primary" href="/try">Try it in the browser <ArrowRight size={14} /></Button>
		<Button href={cursorDeeplink(endpoint())}>Install in Cursor</Button>
	</div>
	<p class="mt-4 text-sm text-ink-2">No key, no sign-up, read-only.</p>
</section>

<section class="border-t border-line">
	<div class="mx-auto max-w-6xl px-4 py-16">
		<h2 class="text-2xl font-medium text-ink">What the server offers</h2>
		<div class="mt-8 grid gap-4 sm:grid-cols-2">
			{#each offers as o}
				<div class="rounded-lg border border-line bg-surface p-5">
					<o.icon size={18} class="text-accent" aria-hidden="true" />
					<h3 class="mt-3 font-medium text-ink">{o.title}</h3>
					<p class="mt-1.5 text-sm text-ink-2">{o.text}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="border-t border-line" aria-labelledby="what-is">
	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
		<div class="max-w-2xl">
			<h2 id="what-is" class="text-2xl font-medium text-ink">What is OBS + Theological Formation?</h2>
			<p class="mt-4 text-ink-2">
				Open Bible Stories + Theological Formation (OBS-TF) is a resource for the church: fifty
				Bible stories, from Creation to New Creation, that a community studies together, one story
				at a time. Its home is
				<a class="text-accent underline underline-offset-4" href={SITE.links.formationStories}
					>Formation Stories</a
				>, and the stories are
				<a class="text-accent underline underline-offset-4" href={SITE.links.openBibleStories}
					>Open Bible Stories</a
				>, grouped into eleven units that trace the whole story of Scripture.
			</p>
			<p class="mt-4 text-ink-2">
				Every story moves through the Five Movements. A community study opens the story, and a
				conclusion reviews it at the end.
			</p>
			<p class="mt-4 text-ink-2">
				This server serves the edition unfoldingWord publishes on
				<a class="text-accent underline underline-offset-4" href={SITE.links.door43}>Door43</a>, which
				adds translation training: drafting and checking the story in your language are part of
				Movements 2 to 5. It covers the fifty stories and their units. The planning conversations
				that come before the stories are not served yet.
			</p>
			<p class="mt-4 text-sm text-ink-2">
				OBS-TF is also called 5M OBS, after its Five Movements. Content is licensed
				<a class="underline underline-offset-4" href={SITE.links.license}>CC BY-SA 4.0</a>.
			</p>
			<ul class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
				<li><a class="text-accent hover:underline" href={SITE.links.enRepo}>en_obs-tf on Door43</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.idRepo}>id_obs-tf on Door43</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.overview}>The manual’s overview</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.uwContent}>unfoldingWord content</a></li>
			</ul>
		</div>
		<ol class="space-y-3 self-start rounded-lg border border-line bg-surface p-5">
			<li class="text-xs text-accent-2">The Five Movements</li>
			{#each movements as [name, line], i}
				<li class="flex gap-3">
					<span class="font-mono text-sm text-accent">{i + 1}</span>
					<span>
						<span class="block text-sm text-ink">{name}</span>
						<span class="block text-xs text-ink-2">{line}</span>
					</span>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="border-t border-line" aria-labelledby="anatomy">
	<div class="mx-auto max-w-6xl px-4 py-16">
		<h2 id="anatomy" class="text-2xl font-medium text-ink">Anatomy of a story</h2>
		<p class="mt-2 max-w-2xl text-ink-2">
			Every story has the same nine parts. Pick one to see what it holds and how an assistant asks
			for it. The example is story 1, The Creation.
		</p>
		<div class="mt-8"><AnatomyExplorer /></div>
	</div>
</section>

<section class="border-t border-line" aria-labelledby="ask">
	<div class="mx-auto max-w-6xl px-4 py-16">
		<h2 id="ask" class="text-2xl font-medium text-ink">What you can ask</h2>
		<p class="mt-2 max-w-2xl text-ink-2">
			You talk to your assistant as usual. It picks the tool and the arguments.
		</p>
		<ul class="mt-8 divide-y divide-line rounded-lg border border-line">
			{#each HOME_EXAMPLES as ex}
				<li class="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
					<p class="text-ink">“{ex.ask}”</p>
					<code class="overflow-x-auto font-mono text-xs text-ink-2"
						>{ex.tool} {JSON.stringify(ex.args)}</code
					>
					<a
						class="inline-flex items-center gap-1 text-sm text-accent hover:underline"
						href={exampleHref(ex.tool, ex.args)}>Run <ArrowRight size={14} /></a
					>
				</li>
			{/each}
		</ul>
	</div>
</section>

<section class="border-t border-line" aria-labelledby="who">
	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
		<div>
			<h2 id="who" class="text-2xl font-medium text-ink">Who uses it</h2>
			<p class="mt-4 text-ink-2">
				BT Servant, unfoldingWord’s assistant for Bible translators, uses this server to lead a
				translation team through a story, movement by movement. Any assistant that speaks MCP over
				Streamable HTTP can do the same.
			</p>
		</div>
		<div>
			<h2 class="text-2xl font-medium text-ink">Connect your assistant</h2>
			<p class="mt-4 text-ink-2">Setup takes one command or one click.</p>
			<ul class="mt-4 flex flex-wrap gap-2">
				{#each clients as c}
					<li class="rounded border border-line-strong px-2.5 py-1 text-sm text-ink-2">{c}</li>
				{/each}
			</ul>
			<div class="mt-6"><Button href="/connect">See setup for each client <ArrowRight size={14} /></Button></div>
		</div>
	</div>
</section>
