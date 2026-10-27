<script lang="ts">
	// Source: src/content/obsTfReference.ts (parseObsTfReference).
	const forms = [
		['"1"', 'The whole of story 1.'],
		['"1:5"', 'Story 1, panel 5: the story text and the per-panel questions for that panel only.'],
		['"1:0"', 'Story 1, the introduction.'],
		['"obs 1:5"', 'The same as "1:5". The "obs" prefix is optional.'],
		['"01:05"', 'Leading zeros are fine.']
	];
</script>

<h1>Stories and panels</h1>
<p>
	The <code>reference</code> argument of <code>fetch_obs_study_manual</code> picks a story, and
	optionally one panel of it. Stories are numbered 1 to 50. Panels are numbered within each story,
	and the manual labels them like <code>01-05</code> (story 1, panel 5).
</p>

<div class="table-wrap">
	<table>
		<thead><tr><th>reference</th><th>Means</th></tr></thead>
		<tbody>
			{#each forms as [ref, text]}
				<tr><td><code>{ref}</code></td><td>{text}</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>What a panel narrows</h2>
<p>
	With a panel, the observation and translation questions keep only that panel, and discourse
	questions keep the ones that mention it. Parts without per-panel content, such as Movements 4 and
	5, come back whole.
</p>

<h2>What is rejected</h2>
<p>
	Story numbers outside 1 to 50, Bible references such as <code>GEN 1:1</code>, and
	<code>front</code> are invalid and return an error that says which forms work.
</p>
