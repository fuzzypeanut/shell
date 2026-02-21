<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { handleCallback } from '$lib/auth/oidc';

	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			await handleCallback();
			goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Authentication failed';
		}
	});
</script>

{#if error}
	<div class="error">
		<h2>Sign-in failed</h2>
		<p>{error}</p>
		<a href="/">Try again</a>
	</div>
{:else}
	<div class="loading">Completing sign-in…</div>
{/if}

<style>
	.loading, .error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}
</style>
