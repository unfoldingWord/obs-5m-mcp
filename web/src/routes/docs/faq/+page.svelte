<script lang="ts">
	import { SITE } from '$lib/site';
	const faq = [
		['Is it free?', 'Yes. The server is public and the content is licensed CC BY-SA 4.0.'],
		['Does it need a key or an account?', 'No. Point your client at the server URL.'],
		['Can it change content?', 'No. Every tool is read-only. Content changes happen on Door43.'],
		['Which languages?', 'English and Indonesian today. list_languages returns the current list.'],
		[
			'Does it include the planning conversations that come before the stories?',
			'Not yet. The server covers the fifty stories, their eleven units and the Five Movements.'
		],
		[
			'How does BT Servant use it?',
			'BT Servant calls the server to lead a translation team through a story, one part at a time, and quotes the questions from the answers.'
		],
		['Where is the source code?', `On GitHub: ${SITE.repo}`]
	];
</script>

<h1>FAQ</h1>
{#each faq as [q, a]}
	<h2>{q}</h2>
	<p>{a}</p>
{/each}
