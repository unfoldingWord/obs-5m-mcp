<script lang="ts">
	// Source: src/mcp/tools/fetchObsStudyManual.ts, src/content/studyManual.ts (toClientMovement).
</script>

<h1>Questions only</h1>
<p>
	The manual gives answers to its observation and discourse questions. They are for the leaders who
	guide the group. The community works through the questions themselves.
</p>
<p>Two arguments of <code>fetch_obs_study_manual</code> give the community view:</p>
<ul class="list">
	<li>
		<code>include_answers: false</code> returns the questions without the answers, grouped by panel. It
		leaves out the story text, community study and conclusion, and Translation Questions, which are
		guidance rather than questions.
	</li>
	<li>
		<code>section: "observation"</code> or <code>"translation"</code> returns one Movement 1 list. It
		implies <code>part: "movement1"</code>.
	</li>
	<li>Combine them with a panel range such as <code>"1:5-8"</code> to hand a group a few panels at a time.</li>
</ul>
<p>
	On the <a href="/try">try page</a>, the guided session shows a Leader view (with answers) and a
	Community view (questions only).
</p>
