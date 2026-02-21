<script lang="ts">
	import { page } from '$app/stores';
	import { registry } from '$lib/stores/registry.svelte';
	import { loadModule } from '$lib/modules';

	// Find the module that owns this path
	let currentModule = $derived(
		registry.modules.find((m) =>
			m.routes.some((r) => `/${$page.params.path}`.startsWith(r))
		) ?? null
	);

	// Loaded component — null while loading, undefined if no module matches
	let component = $state<unknown>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		if (!currentModule) {
			component = null;
			return;
		}
		loadError = null;
		loadModule(currentModule)
			.then((c) => { component = c; })
			.catch((e) => {
				loadError = e instanceof Error ? e.message : 'Failed to load module';
				console.error('[FuzzyPeanut] Module load error:', e);
			});
	});
</script>

{#if !currentModule}
	<div class="not-found">
		<h2>404</h2>
		<p>No module handles this path.</p>
	</div>
{:else if loadError}
	<div class="error">
		<h2>Module failed to load</h2>
		<p>{loadError}</p>
	</div>
{:else if !component}
	<div class="loading">
		<span class="spinner"></span>
	</div>
{:else}
	{@const DynamicModule = component as import('svelte').Component}
	<DynamicModule />
{/if}

<style>
	.not-found, .error, .loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.75rem;
		color: var(--fp-text);
	}

	.not-found, .error { opacity: 0.5; }

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--fp-border, #e0e0ef);
		border-top-color: var(--fp-primary, #5b4fcf);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
