<script lang="ts">
	// Sources: src/core/rateLimit.ts, src/mcp/tools/shared.ts (_meta.response_size_bytes).
</script>

<h1>Limits and sizes</h1>

<h2>Rate limit</h2>
<p>
	The server allows 90 requests per minute from one address by default. Past that it answers HTTP 429
	with a <code>Retry-After</code> header in seconds. The limit applies to the try page too.
</p>

<h2>Response sizes</h2>
<p>
	Some clients cut long tool results. A whole story with every part is large, so ask for one part at a
	time, and one panel when that is all the group needs. The try page shows the size of every answer.
</p>
<p>
	Every answer carries <code>_meta</code> with <code>downstream_api_calls</code>,
	<code>cache_status</code> and <code>response_size_bytes</code>, so a client can track what a call
	cost.
</p>

<h2>Caching</h2>
<p>Content from Door43 is cached on the server, so repeated calls are fast.</p>
