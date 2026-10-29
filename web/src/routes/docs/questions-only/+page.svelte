<script lang="ts">
	// Source: src/mcp/tools/fetchObsStudyManual.ts, src/content/studyManual.ts (HAS_ANSWERS, toClientMovement).
</script>

<h1>Without answers</h1>
<p>
	The manual is written for the whole group. Only two kinds of questions come with answers: the
	Observation Questions in Movement 1 and the Discourse Questions in Movement 2. The answers help
	whoever guides the session check what the group found. The group works through the questions
	themselves.
</p>
<p>Two arguments of <code>fetch_obs_study_manual</code> shape what a group receives:</p>
<ul class="list">
	<li>
		<code>include_answers: false</code> leaves out those answers and nothing else. The story, the
		Translation Questions, the theological and reflection questions, and every other part come back as
		usual.
	</li>
	<li>
		<code>section: "observation"</code> or <code>"translation"</code> returns one Movement 1 list on its
		own, without the story around it. It implies <code>part: "movement1"</code>.
	</li>
	<li>
		Together, with a panel range such as <code>"1:5-8"</code>, they give the observation questions to
		hand a group a few panels at a time.
	</li>
</ul>
<p>
	On the <a href="/try">try page</a>, the guided session has a Leader view (with answers) and a
	Community view (without them). They differ only in Movements 1 and 2.
</p>
