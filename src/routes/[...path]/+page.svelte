<script lang="ts">
	import { page } from '$app/stores';
	import { registry } from '$lib/stores/registry.svelte';
	import { loadModule } from '$lib/modules';

	let container = $state<HTMLDivElement | null>(null);
	let loadError = $state<string | null>(null);
	let mountedInstance = $state<unknown>(null);
	let mountedModuleId = $state<string | null>(null);

	// Find the module that owns this path
	let currentModule = $derived(
		registry.modules.find((m) =>
			m.routes.some((r) => `/${$page.params.path}`.startsWith(r))
		) ?? null
	);

	$effect(() => {
		const mod = currentModule;
		const target = container;

		if (!mod || !target) {
			unmountCurrent();
			return;
		}

		// Already mounted — no-op
		if (mountedModuleId === mod.id) return;

		unmountCurrent();
		loadError = null;

		loadModule(mod)
			.then((fpmod) => {
				if (!container) return; // navigated away
				mountedInstance = fpmod.mount(container);
				mountedModuleId = mod.id;
			})
			.catch((e) => {
				loadError = e instanceof Error ? e.message : 'Failed to load module';
				console.error('[FuzzyPeanut] Module load error:', e);
			});
	});

	function unmountCurrent() {
		if (mountedInstance && mountedModuleId) {
			const cached = registry.modules.find((m) => m.id === mountedModuleId);
			if (cached) {
				loadModule(cached)
					.then((fpmod) => fpmod.unmount(mountedInstance))
					.catch(() => {});
			}
		}
		mountedInstance = null;
		mountedModuleId = null;
	}
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
{:else if !mountedInstance}
	<div class="loading">
		<span class="spinner"></span>
	</div>
{/if}

<!-- Module mounts into this div via fpmod.mount(container) -->
<div
	bind:this={container}
	class="module-container"
	class:hidden={!mountedInstance}
></div>

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

	.module-container {
		width: 100%;
		height: 100%;
	}

	.hidden { display: none; }
</style>
