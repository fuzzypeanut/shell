<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { registry } from '$lib/stores/registry.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { setupSDK } from '$lib/sdk';
	import type { ModuleInfo } from '@fuzzypeanut/sdk';

	let { children } = $props();

	let ready = $state(false);

	onMount(async () => {
		// 1. Inject the SDK singleton — must happen before any module loads
		setupSDK();
		// 2. Init auth — redirects to Authentik if not logged in
		await auth.init();
		// 3. Load registered modules from the registry service
		await registry.load();
		// 4. Subscribe to SSE for live module registration changes
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
	}

	// Sorted nav items from all installed modules
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
						<a href={mod.routes[0]} class="nav-item">
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
			{@render children()}
		</main>

		{#if notifications.items.length > 0}
			<div class="notifications" aria-live="polite">
				{#each notifications.items as n (n.id)}
					<div class="notification notification--{n.type}" role="alert">
						<div class="notification-body">
							<strong>{n.title}</strong>
							{#if n.message}<p>{n.message}</p>{/if}
						</div>
						<button onclick={() => notifications.dismiss(n.id)} aria-label="Dismiss">✕</button>
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

	.nav-item:hover {
		background: var(--fp-border);
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
		overflow: auto;
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

	.notification button {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--fp-text);
		opacity: 0.5;
		flex-shrink: 0;
	}

	.notification--error { border-left: 3px solid #e53e3e; }
	.notification--success { border-left: 3px solid #38a169; }
	.notification--warning { border-left: 3px solid #d69e2e; }
	.notification--info { border-left: 3px solid var(--fp-primary); }
</style>
