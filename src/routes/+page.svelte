<script lang="ts">
	import { registry } from '$lib/stores/registry.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Redirect to the first installed module, or show empty state
		const first = [...registry.modules]
			.filter((m) => m.nav)
			.sort((a, b) => (a.nav!.order ?? 99) - (b.nav!.order ?? 99))[0];
		if (first) goto(first.routes[0]);
	});
</script>

<div class="empty-state">
	<span class="icon">🥜</span>
	<h2>No modules installed</h2>
	<p>Add a FuzzyPeanut module to get started.</p>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.75rem;
		color: var(--fp-text);
		opacity: 0.5;
	}

	.icon { font-size: 3rem; }
	h2 { font-size: 1.25rem; font-weight: 600; }
	p { font-size: 0.9rem; }
</style>
