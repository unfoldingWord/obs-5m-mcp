<script lang="ts">
	// Source: src/content/studyManual.ts (STUDY_MANUAL_PARTS, sessionFlow, buildStudyManualPayload).
	const parts = [
		['full', 'Everything for the story (the default).'],
		['intro', 'Key idea, creedal verse and metanarrative summary.'],
		['frames', 'The story text, panel by panel, with the Bible passages it retells.'],
		['community', 'The community study read together before the movements.'],
		['movement1', 'Biblical Interpretation: observation questions and translation questions for each panel.'],
		['movement2', 'Theological Dialogue: discourse and theological questions, plus the translation draft.'],
		['drafting', 'Only the translation draft step.'],
		['movement3', 'Personal Reflection: journal reflection, plus the team check.'],
		['checking', 'Only the team check step.'],
		['movement4', 'Ministry Practice: church ministry and the church community check.'],
		['movement5', 'Missional Outreach: mission engagement and the sociolinguistic check.'],
		['conclusion', 'The community review that closes the story.']
	];
</script>

<h1>Sessions and parts</h1>
<p>
	A group studies one story in one session, part by part. <code>fetch_obs_study_manual</code> takes a
	<code>part</code> so an assistant can open the part the group is on and nothing else.
</p>

<h2>The order of a session</h2>
<p>
	Every answer includes <code>sessionFlow</code>, the order to follow:
	<code>intro → frames → community → movement1 → movement2 → drafting → movement3 → checking →
		movement4 → movement5 → conclusion</code>.
</p>

<h2>Parts</h2>
<div class="table-wrap">
	<table>
		<thead><tr><th>part</th><th>What it returns</th></tr></thead>
		<tbody>
			{#each parts as [id, text]}
				<tr><td><code>{id}</code></td><td>{text}</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>part or movement</h2>
<p>
	<code>movement</code> (1 to 5) still works and is the same as <code>part: "movementN"</code>. When
	both are given, <code>part</code> wins. Use <code>part</code> for drafting, checking and the
	conclusion, which have no movement number.
</p>

<h2>Formats</h2>
<p>
	<code>format</code> is <code>json</code> (default), <code>md</code> or <code>text</code>. All three
	come from the same content. Use <code>md</code> when the assistant will show the text to people.
</p>
