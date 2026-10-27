<script lang="ts">
	// Sources: src/mcp/instructions.ts, src/mcp/toolRegistry.ts.
	import { SITE } from '$lib/site';
	import { endpoint } from '$lib/endpoint.svelte';
</script>

<h1>Overview</h1>
<p>
	{SITE.name} is a read-only MCP server. It gives AI assistants the Open Bible Stories + Theological
	Formation study manual: fifty stories, each with an introduction, the story panels, a community
	study, the Five Movements and a conclusion.
</p>
<p>The server URL is <code>{endpoint()}</code>. It needs no key.</p>

<h2>How an assistant uses it</h2>
<ul class="list">
	<li>Find what exists: <code>list_languages</code>, <code>list_collections</code> (the eleven units) and <code>list_stories</code>.</li>
	<li>Learn the session structure: <code>get_framework</code> returns the Five Movements and the order of a session.</li>
	<li>Read the manual one part at a time with <code>fetch_obs_study_manual</code>, the main tool.</li>
	<li>Use the helpers for focused reads and search: <code>get_story</code>, <code>get_movement</code>, <code>get_devotional</code>, <code>get_study_guide</code>, <code>search_content</code> and <code>get_pdf</code>.</li>
</ul>
<p>
	The server also sends instructions to the assistant when it connects: quote the study questions from
	the tools, and never invent replacements.
</p>

<h2>Where to go next</h2>
<ul class="list">
	<li><a href="/docs/sessions">Sessions and parts</a>: walk a group through a story.</li>
	<li><a href="/docs/references">Stories and panels</a>: ask for one story or one panel.</li>
	<li><a href="/tools">All tools</a>: every parameter, generated from the server.</li>
	<li><a href="/try">Try it</a>: run any call in the browser.</li>
</ul>
