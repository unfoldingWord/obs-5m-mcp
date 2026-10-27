<script lang="ts">
	// Sources: src/content/contentService.ts, src/content/dcsFetcher.ts, src/mcp/instructions.ts.
	import { SITE } from '$lib/site';
</script>

<h1>Sources and languages</h1>
<p>
	The content comes from the Door43 catalog: resources with the subject
	<code>OBS Theological Formation</code> and the topic <code>tc-ready</code>. Today that is
	<a href={SITE.links.enRepo}>en_obs-tf</a> (English) and
	<a href={SITE.links.idRepo}>id_obs-tf</a> (Indonesian). <code>list_languages</code> always returns the
	current list.
</p>
<p>
	The shared sections of the manual, such as the community studies and Movements 4 and 5, are
	resolved for you. An answer reads the same whether a section is shared between stories or written
	inside one story.
</p>

<h2>When a story is missing</h2>
<p>
	If a language has no content for a story, the tool answers <code>available: false</code> with the
	code <code>RESOURCE_NOT_AVAILABLE</code>. It is an answer, not a failure.
</p>
<p>
	For Indonesian, the server also ships converted markdown, used when Door43 has no entry for a story.
</p>

<h2>When Door43 cannot be reached</h2>
<p>
	The tool returns <code>UPSTREAM_DCS_ERROR</code>, which means “try again later”, never “does not
	exist”. Languages with shipped markdown are still served.
</p>

<h2>License</h2>
<p>
	The content is licensed <a href={SITE.links.license}>CC BY-SA 4.0</a>. Theological Formation is
	described at <a href={SITE.links.formationStories}>Formation Stories</a>.
</p>
