<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import { ART_CREDIT, STORYBOARD, panelSrc } from '$lib/obs/storyboard';
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
			title: 'A whole story, or one part of it',
			text: 'Get the full session in order, or only the part your group is on: the introduction, the story panels, the community study, one movement, the drafting or checking step, or the conclusion.'
		},
		{
			title: 'Down to a single panel',
			text: 'Ask for panel 5 of story 1 and get the questions for that panel only, not the whole story.'
		},
		{
			title: 'The manual’s own words',
			text: 'Every answer is the published text, not a summary, so an assistant can quote the questions exactly as written.'
		},
		{
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
	<title>{SITE.fullName}</title>
	<meta
		name="description"
		content="A read-only MCP server that gives AI assistants the Open Bible Stories + Theological Formation study manual from Door43. No key or sign-up."
	/>
</svelte:head>

<section class="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
	<div class="rise">
		<h1 class="text-4xl leading-[1.05] font-bold tracking-tight text-ink sm:text-6xl">
			MCP Server for Open Bible Stories with Theological Formation
		</h1>
		<p class="mt-6 max-w-xl text-lg text-ink sm:text-xl">
			Fifty Bible stories and the Five Movements study manual, word for word, for your AI
			assistant.
		</p>
		<p class="mt-3 max-w-xl text-base text-ink-2">
			Connect Claude, Cursor or BT Servant, ask for a story, a movement or a single panel, and get
			the manual’s own words from Door43. No key, no sign-up, read-only.
		</p>
		<div class="mt-8 flex flex-wrap items-center gap-3">
			<Button variant="primary" href="/try">Try it in the browser <ArrowRight size={14} /></Button>
			<Button href={cursorDeeplink(endpoint())}>Install in Cursor</Button>
		</div>
		<div class="mt-4"><CopyPill value={endpoint()} label="Copy the server URL" /></div>
	</div>

	<figure class="rise rise-2 relative">
		<img
			src={panelSrc('01-05', 1280)}
			alt="Open Bible Stories panel 01-05: trees, flowers and fruit on the third day of creation"
			width="1280"
			height="720"
			class="aspect-[16/9] w-full rounded-md object-cover"
			fetchpriority="high"
		/>
		<div
			class="float-card mx-4 -mt-16 rounded-md bg-surface p-4 shadow-2xl shadow-black/40 sm:absolute sm:-right-6 sm:-bottom-12 sm:mx-0 sm:mt-0 sm:w-[22rem]"
		>
			<p class="font-mono text-[11px] text-accent-2">
				fetch_obs_study_manual {'{'} reference: "1:5", part: "movement1" {'}'}
			</p>
			<p class="mt-2 text-sm font-semibold text-ink">Observation questions · 01-05</p>
			<p class="mt-1 text-sm text-ink">What else did God create on the third day?</p>
			<p class="mt-1 text-sm text-ink-2">
				What was God’s response to the trees and plants he created on the third day?
			</p>
		</div>
		<figcaption class="mt-3 text-xs text-ink-2 sm:mt-4 sm:max-w-[calc(100%-22rem)]">
			Story 1, panel 5 · <a class="hover:text-ink" href={ART_CREDIT.href}>{ART_CREDIT.text}</a>
		</figcaption>
	</figure>
</section>

<section class="bg-surface" aria-labelledby="storyboard">
	<div class="mx-auto max-w-6xl px-4 py-16">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<h2 id="storyboard" class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
				Fifty stories, from Creation to New Creation
			</h2>
			<p class="max-w-md text-sm text-ink-2">
				Every story has its panels, its community study and the Five Movements. Pick one to walk
				through its session.
			</p>
		</div>
		<ul class="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
			{#each STORYBOARD as panel (panel.id)}
				<li>
					<a
						class="group block"
						href={'/try' + encodeTryState({ tab: 'guided', lang: 'en', story: panel.story, part: 'frames' })}
					>
						<div class="overflow-hidden rounded-md">
							<img
								src={panelSrc(panel.id)}
								alt=""
								loading="lazy"
								width="560"
								height="315"
								class="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
							/>
						</div>
						<p class="mt-2 text-sm text-ink-2">Story {panel.story}</p>
						<p class="text-sm font-semibold text-ink group-hover:text-accent">{panel.title}</p>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<section aria-labelledby="offers">
	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
		<h2 id="offers" class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
			What the server offers
		</h2>
		<dl class="grid gap-x-10 gap-y-8 sm:grid-cols-2">
			{#each offers as o}
				<div>
					<dt class="text-lg font-semibold text-ink">{o.title}</dt>
					<dd class="mt-2 text-ink-2">{o.text}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<section class="bg-surface" aria-labelledby="what-is">
	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
		<div class="max-w-2xl">
			<h2 id="what-is" class="text-2xl font-semibold tracking-tight text-ink">What is OBS + Theological Formation?</h2>
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
				Its short name is OBS-TF, and it is also called 5M OBS, after its Five Movements. Content is licensed
				<a class="underline underline-offset-4" href={SITE.links.license}>CC BY-SA 4.0</a>.
			</p>
			<ul class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
				<li><a class="text-accent hover:underline" href={SITE.links.enRepo}>en_obs-tf on Door43</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.idRepo}>id_obs-tf on Door43</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.overview}>The manual’s overview</a></li>
				<li><a class="text-accent hover:underline" href={SITE.links.uwContent}>unfoldingWord content</a></li>
			</ul>
		</div>
		<ol class="space-y-4 self-start rounded-md bg-bg p-6">
			<li class="text-xs text-accent-2">The Five Movements</li>
			{#each movements as [name, line], i}
				<li class="flex gap-3">
					<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
					<span>
						<span class="block font-semibold text-ink">{name}</span>
						<span class="block text-xs text-ink-2">{line}</span>
					</span>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section aria-labelledby="anatomy">
	<div class="mx-auto max-w-6xl px-4 py-20">
		<h2 id="anatomy" class="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Anatomy of a story</h2>
		<p class="mt-2 max-w-2xl text-ink-2">
			Every story has the same nine parts. Pick one to see what it holds and how an assistant asks
			for it. The example is story 1, The Creation.
		</p>
		<div class="mt-8"><AnatomyExplorer /></div>
	</div>
</section>

<section class="bg-surface" aria-labelledby="ask">
	<div class="mx-auto max-w-6xl px-4 py-20">
		<h2 id="ask" class="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">What you can ask</h2>
		<p class="mt-2 max-w-2xl text-ink-2">
			You talk to your assistant as usual. It picks the tool and the arguments.
		</p>
		<ul class="mt-8 space-y-2">
			{#each HOME_EXAMPLES as ex}
				<li class="grid gap-2 rounded-md bg-bg p-4 transition-colors hover:bg-bg/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
					<p class="font-semibold text-ink">“{ex.ask}”</p>
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

<section class="bg-accent text-on-accent" aria-labelledby="who">
	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2">
		<div>
			<h2 id="who" class="text-2xl font-semibold tracking-tight sm:text-3xl">Who uses it</h2>
			<p class="mt-4 text-lg">
				BT Servant, unfoldingWord’s assistant for Bible translators, uses this server to lead a
				translation team through a story, movement by movement. Any assistant that speaks MCP over
				Streamable HTTP can do the same.
			</p>
		</div>
		<div>
			<h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Connect your assistant</h2>
			<p class="mt-4 text-lg">Setup takes one command or one click: {clients.join(', ')}.</p>
			<a
				href="/connect"
				class="mt-6 inline-flex items-center gap-2 rounded-md bg-on-accent px-4 py-2.5 text-sm font-semibold text-accent transition-opacity hover:opacity-90"
				>See setup for each client <ArrowRight size={14} /></a
			>
		</div>
	</div>
</section>
