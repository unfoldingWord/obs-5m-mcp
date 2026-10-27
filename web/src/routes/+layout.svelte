<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { live } from '$lib/endpoint.svelte';

	let { children } = $props();
	onMount(() => (live.origin = window.location.origin));
</script>

<SiteHeader />
<main>
	{@render children()}
</main>
<SiteFooter />
