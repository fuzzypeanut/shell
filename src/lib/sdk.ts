/**
 * Shell-side implementation of FuzzyPeanutSDK.
 * Injected via initSDK() at app startup. Remote modules receive this instance
 * via the window.__fuzzyPeanutSDK global.
 */
import { initSDK, type FuzzyPeanutSDK, type SDKPrefs } from '@fuzzypeanut/sdk';
import { auth } from '$lib/stores/auth.svelte';
import { registry } from '$lib/stores/registry.svelte';
import { notifications } from '$lib/stores/notifications.svelte';
import { theme } from '$lib/stores/theme.svelte';
import { eventBus } from '$lib/events';
import { getAccessToken, userManager } from '$lib/auth/oidc';
import { goto } from '$app/navigation';

// ─── sdk.prefs ────────────────────────────────────────────────────────────────

const prefs: SDKPrefs = {
	get<T>(key: string, defaultValue: T): T {
		try {
			const raw = localStorage.getItem(`fp:prefs:${key}`);
			if (raw === null) return defaultValue;
			return JSON.parse(raw) as T;
		} catch {
			return defaultValue;
		}
	},
	set(key: string, value: unknown): void {
		try {
			localStorage.setItem(`fp:prefs:${key}`, JSON.stringify(value));
		} catch { /* localStorage unavailable — no-op */ }
	},
	remove(key: string): void {
		try {
			localStorage.removeItem(`fp:prefs:${key}`);
		} catch { /* localStorage unavailable — no-op */ }
	}
};

// ─── Shell SDK instance ───────────────────────────────────────────────────────

const shellSDK: FuzzyPeanutSDK = {
	auth: {
		getToken: getAccessToken,

		// Returns null before auth initializes or when the user is logged out.
		getUser: () => auth.user,

		onTokenRefresh: (cb) => {
			const handler = (user: import('oidc-client-ts').User) => cb(user.access_token);
			userManager.events.addUserLoaded(handler);
			return () => userManager.events.removeUserLoaded(handler);
		},

		onAuthChange: (cb) => {
			// Fire immediately with current state so callers can initialize
			cb(auth.user);
			const loadedHandler = () => cb(auth.user);
			const unloadedHandler = () => cb(null);
			userManager.events.addUserLoaded(loadedHandler);
			userManager.events.addUserUnloaded(unloadedHandler);
			return () => {
				userManager.events.removeUserLoaded(loadedHandler);
				userManager.events.removeUserUnloaded(unloadedHandler);
			};
		}
	},

	events: {
		emit: (event: string, payload?: unknown) => eventBus.emit(event, payload),
		on: (event: string, handler: (payload: unknown) => void) => eventBus.on(event, handler)
	},

	registry: {
		getModules: () => registry.getModules(),
		hasModule: (id) => registry.hasModule(id),
		onModuleInstalled: (id, cb) => registry.onModuleInstalled(id, cb),
		onModuleRemoved: (id, cb) => registry.onModuleRemoved(id, cb)
	},

	notifications: {
		push: (n) => notifications.push(n)
	},

	navigate: {
		to: (path) => goto(path)
	},

	theme: {
		getCurrent: () => theme.getCurrent(),
		onChange: (cb) => theme.onChange(cb)
	},

	prefs,

	// Not configured at the shell level. Modules needing object storage
	// wire their own backends; these are available for future platform-level config.
	objectStore: undefined,
	delivery: undefined
};

export function setupSDK() {
	initSDK(shellSDK);
}
