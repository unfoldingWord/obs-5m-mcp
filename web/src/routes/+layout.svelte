<script lang="ts">
	import '../app.css';
	import { onDestroy, onMount } from 'svelte';

	let vvh = '100dvh';
	let removeVvListeners: (() => void) | undefined;

	function syncVisualViewport() {
		const vv = typeof window !== 'undefined' ? window.visualViewport : null;
		if (!vv) {
			vvh = '100dvh';
			document.documentElement.style.setProperty('--vvh', '100dvh');
			return;
		}
		vvh = `${Math.max(0, vv.height)}px`;
		document.documentElement.style.setProperty('--vvh', vvh);
	}

	onMount(() => {
		const vv = window.visualViewport;
		syncVisualViewport();
		if (!vv) return;
		const onChange = () => syncVisualViewport();
		vv.addEventListener('resize', onChange);
		vv.addEventListener('scroll', onChange);
		removeVvListeners = () => {
			vv.removeEventListener('resize', onChange);
			vv.removeEventListener('scroll', onChange);
		};
	});

	onDestroy(() => {
		removeVvListeners?.();
	});
</script>

<slot />
