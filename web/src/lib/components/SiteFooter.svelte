<script lang="ts">
	import { SITE } from '$lib/site';
</script>

<footer class="mt-24 border-t border-line">
	<div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
		<div>
			<p class="font-medium text-ink">{SITE.name}</p>
			<p class="mt-2 text-ink-2">
				An MCP server for Open Bible Stories + Theological Formation, by unfoldingWord.
			</p>
		</div>
		<div>
			<p class="text-xs text-accent-2">Content</p>
			<ul class="mt-2 space-y-1 text-ink-2">
				<li><a class="hover:text-ink" href={SITE.links.formationStories}>Formation Stories</a></li>
				<li><a class="hover:text-ink" href={SITE.links.openBibleStories}>Open Bible Stories</a></li>
				<li><a class="hover:text-ink" href={SITE.links.enRepo}>en_obs-tf on Door43</a></li>
				<li><a class="hover:text-ink" href={SITE.links.license}>License: CC BY-SA 4.0</a></li>
			</ul>
		</div>
		<div>
			<p class="text-xs text-accent-2">Server</p>
			<ul class="mt-2 space-y-1 text-ink-2">
				<li><a class="hover:text-ink" href={SITE.repo}>Source on GitHub</a></li>
				<li><a class="hover:text-ink" href="/llms.txt">llms.txt</a></li>
				<li><a class="hover:text-ink" href="/api/mcp-manifest">Tool manifest</a></li>
				<li><a class="hover:text-ink" href="/health">Health</a></li>
			</ul>
		</div>
	</div>
</footer>
