<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth.svelte';
	import { registry } from '$lib/stores/registry.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { setupSDK } from '$lib/sdk';
	import { loadModule, evictModule } from '$lib/modules';
	import { eventBus } from '$lib/events';
	import type { FPModule, ModuleInfo } from '@fuzzypeanut/sdk';

	let { children } = $props();

	let ready = $state(false);

	// ─── Module dock (stay-alive) ─────────────────────────────────────────────

	type MountEntry = { fpmod: FPModule; instance: unknown; el: HTMLDivElement };
	// Plain Map — not reactive. Effects track reactive deps (registry.modules, currentModule)
	// and mutate this imperatively.
	const mountedModules = new Map<string, MountEntry>();

	let dock = $state<HTMLDivElement | null>(null);
	let activeModuleId = $state<string | null>(null);
	let loadingModuleId = $state<string | null>(null);
	let moduleLoadError = $state<string | null>(null);

	// Current module based on URL path
	let currentPath = $derived(`/${$page.params.path ?? ''}`);
	let currentModule = $derived(
		registry.modules.find((m: ModuleInfo) =>
			m.routes.some((r) => currentPath.startsWith(r))
		) ?? null
	);

	// React to route changes: deactivate old module, activate or mount new one
	$effect(() => {
		const mod = currentModule;
		const dockEl = dock;
		if (!dockEl || !ready) return;

		const newId = mod?.id ?? null;
		if (newId === activeModuleId) return;

		// Deactivate previous
		if (activeModuleId) {
			const prev = mountedModules.get(activeModuleId);
			if (prev) {
				prev.fpmod.onInactive?.(prev.instance);
				prev.el.style.display = 'none';
			}
		}

		moduleLoadError = null;
		activeModuleId = newId;

		if (!mod || !newId) return;

		// Already mounted — show and activate
		const existing = mountedModules.get(newId);
		if (existing) {
			existing.el.style.display = '';
			existing.fpmod.onActive?.(existing.instance);
			return;
		}

		// First visit — create container, mount module
		loadingModuleId = newId;
		const el = document.createElement('div');
		el.className = 'module-container';
		el.style.display = 'none'; // hidden until mount completes
		dockEl.appendChild(el);

		loadModule(mod)
			.then((fpmod) => {
				if (activeModuleId !== newId) {
					// User navigated away before load finished
					el.remove();
					return;
				}
				const instance = fpmod.mount(el);
				mountedModules.set(newId, { fpmod, instance, el });
				el.style.display = '';
				fpmod.onActive?.(instance);
			})
			.catch((err) => {
				el.remove();
				if (activeModuleId === newId) {
					moduleLoadError = err instanceof Error ? err.message : 'Failed to load module';
				}
				console.error('[FuzzyPeanut] Module load error:', err);
			})
			.finally(() => {
				if (loadingModuleId === newId) loadingModuleId = null;
			});
	});

	// Handle module deregistration — unmount mounted instances, evict cache
	$effect(() => {
		// Reading registry.modules triggers this effect when the list changes
		const currentIds = new Set(registry.modules.map((m: ModuleInfo) => m.id));
		for (const [id, entry] of mountedModules) {
			if (!currentIds.has(id)) {
				entry.fpmod.unmount(entry.instance);
				entry.el.remove();
				mountedModules.delete(id);
				evictModule(id);
				if (activeModuleId === id) {
					activeModuleId = null;
					moduleLoadError = 'This module is no longer available.';
				}
			}
		}
	});

	// ─── App init ─────────────────────────────────────────────────────────────

	onMount(async () => {
		setupSDK();
		await auth.init();
		await registry.load();
		subscribeToRegistryEvents();
		ready = true;
	});

	function subscribeToRegistryEvents() {
		const registryUrl = `${import.meta.env.VITE_REGISTRY_URL ?? 'http://localhost:3100'}/events`;
		const es = new EventSource(registryUrl);
		es.onmessage = (e) => {
			try {
				registry.handleEvent(JSON.parse(e.data));
			} catch {
				// ignore malformed events
			}
		};
		// EventSource auto-reconnects on network drops — no manual retry needed
	}

	// ─── Nav ──────────────────────────────────────────────────────────────────

	let navItems = $derived(
		[...registry.modules]
			.filter((m: ModuleInfo) => m.nav)
			.sort((a: ModuleInfo, b: ModuleInfo) => (a.nav!.order ?? 99) - (b.nav!.order ?? 99))
	);
</script>

<svelte:head>
	<title>FuzzyPeanut</title>
</svelte:head>

{#if !ready}
	<div class="loading">
		<span class="spinner" aria-label="Loading FuzzyPeanut…"></span>
	</div>
{:else}
	<div class="shell" data-theme={theme.current.mode}>
		<nav class="sidebar">
			<div class="logo">
				<span class="logo-icon">🥜</span>
				<span class="logo-text">FuzzyPeanut</span>
			</div>

			<ul class="nav-items">
				{#each navItems as mod (mod.id)}
					<li>
						<a
							href={mod.routes[0]}
							class="nav-item"
							class:active={currentModule?.id === mod.id}
							aria-current={currentModule?.id === mod.id ? 'page' : undefined}
						>
							<span class="nav-icon">{mod.nav?.icon ?? '●'}</span>
							<span class="nav-label">{mod.nav?.label}</span>
						</a>
					</li>
				{/each}
			</ul>

			<div class="sidebar-footer">
				<button
					class="theme-toggle"
					onclick={() => theme.setMode(theme.current.mode === 'light' ? 'dark' : 'light')}
					aria-label="Toggle theme"
				>
					{theme.current.mode === 'light' ? '🌙' : '☀️'}
				</button>
				{#if auth.user}
					<div class="user-pill">
						{#if auth.user.avatarUrl}
							<img src={auth.user.avatarUrl} alt={auth.user.name} class="avatar" />
						{:else}
							<span class="avatar-fallback">{auth.user.name[0]?.toUpperCase()}</span>
						{/if}
						<span class="user-name">{auth.user.name}</span>
					</div>
				{/if}
			</div>
		</nav>

		<main class="content">
			<!-- Module dock: all mounted module containers live here, shown/hidden by route -->
			<div bind:this={dock} class="module-dock">
				{#if loadingModuleId}
					<div class="module-state">
						<span class="spinner"></span>
					</div>
				{:else if moduleLoadError}
					<div class="module-state module-error">
						<p>{moduleLoadError}</p>
					</div>
				{/if}
			</div>

			<!-- Non-module page content (auth/callback, root empty state, etc.) -->
			{#if !currentModule}
				{@render children()}
			{/if}
		</main>

		{#if notifications.items.length > 0}
			<div class="notifications" aria-live="polite">
				{#each notifications.items as n (n.id)}
					<div class="notification notification--{n.type}" role="alert">
						<div class="notification-body">
							<strong>{n.title}</strong>
							{#if n.message}<p>{n.message}</p>{/if}
							{#if n.actions.length > 0}
								<div class="notification-actions">
									{#each n.actions as action}
										<button
											class="notification-action"
											onclick={() => {
												eventBus.emit(action.event, action.payload);
												notifications.dismiss(n.id);
											}}
										>{action.label}</button>
									{/each}
								</div>
							{/if}
						</div>
						<button
							class="notification-dismiss"
							onclick={() => notifications.dismiss(n.id)}
							aria-label="Dismiss"
						>✕</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	:global([data-theme='dark']) {
		--fp-surface: #1a1a2e;
		--fp-surface-2: #252540;
		--fp-text: #e8e8f0;
		--fp-primary: #7b6fe0;
		--fp-border: #333355;
	}

	:global([data-theme='light']) {
		--fp-surface: #ffffff;
		--fp-surface-2: #f5f5fb;
		--fp-text: #1a1a2e;
		--fp-primary: #5b4fcf;
		--fp-border: #e0e0ef;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: var(--fp-surface, #fff);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e0e0ef;
		border-top-color: #5b4fcf;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.shell {
		display: flex;
		height: 100vh;
		overflow: hidden;
		background: var(--fp-surface);
		color: var(--fp-text);
	}

	.sidebar {
		width: 220px;
		flex-shrink: 0;
		background: var(--fp-surface-2);
		border-right: 1px solid var(--fp-border);
		display: flex;
		flex-direction: column;
		padding: 1rem 0;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1.25rem 1rem;
		border-bottom: 1px solid var(--fp-border);
		margin-bottom: 0.75rem;
		font-weight: 700;
		font-size: 1rem;
		color: var(--fp-primary);
	}

	.nav-items {
		list-style: none;
		flex: 1;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1.25rem;
		text-decoration: none;
		color: var(--fp-text);
		transition: background 0.15s;
		font-size: 0.9rem;
	}

	.nav-item:hover { background: var(--fp-border); }

	.nav-item.active {
		background: var(--fp-border);
		color: var(--fp-primary);
		font-weight: 600;
	}

	.sidebar-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--fp-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.theme-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.2rem;
		align-self: flex-end;
	}

	.user-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		overflow: hidden;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.avatar-fallback {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--fp-primary);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.user-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.module-dock {
		width: 100%;
		height: 100%;
		position: relative;
	}

	:global(.module-container) {
		width: 100%;
		height: 100%;
		overflow: auto;
	}

	.module-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.module-error {
		color: var(--fp-text);
		opacity: 0.5;
		font-size: 0.9rem;
	}

	.notifications {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 1000;
		max-width: 380px;
	}

	.notification {
		padding: 0.875rem 1rem;
		border-radius: 8px;
		background: var(--fp-surface-2);
		border: 1px solid var(--fp-border);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.notification-body { flex: 1; }
	.notification-body strong { display: block; font-size: 0.9rem; margin-bottom: 0.2rem; }
	.notification-body p { font-size: 0.83rem; opacity: 0.75; }

	.notification-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.notification-action {
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--fp-border);
		border-radius: 4px;
		background: none;
		color: var(--fp-primary);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.notification-action:hover { background: var(--fp-border); }

	.notification-dismiss {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--fp-text);
		opacity: 0.4;
		flex-shrink: 0;
		font-size: 0.85rem;
	}

	.notification--error { border-left: 3px solid #e53e3e; }
	.notification--success { border-left: 3px solid #38a169; }
	.notification--warning { border-left: 3px solid #d69e2e; }
	.notification--info { border-left: 3px solid var(--fp-primary); }
</style>
