/**
 * Shell-side implementation of FuzzyPeanutSDK.
 * This object is injected into the SDK singleton via initSDK() at app startup.
 * Remote modules that import @fuzzypeanut/sdk receive this instance.
 */
import { initSDK, type FuzzyPeanutSDK } from '@fuzzypeanut/sdk';
import { auth } from '$lib/stores/auth.svelte';
import { registry } from '$lib/stores/registry.svelte';
import { notifications } from '$lib/stores/notifications.svelte';
import { theme } from '$lib/stores/theme.svelte';
import { eventBus } from '$lib/events';
import { getAccessToken, userManager } from '$lib/auth/oidc';
import { goto } from '$app/navigation';

const shellSDK: FuzzyPeanutSDK = {
	auth: {
		getToken: getAccessToken,
		getUser: () => {
			if (!auth.user) throw new Error('[FuzzyPeanut] No authenticated user');
			return auth.user;
		},
		onTokenRefresh: (cb) => {
			const handler = (user: import('oidc-client-ts').User) => cb(user.access_token);
			userManager.events.addUserLoaded(handler);
			return () => userManager.events.removeUserLoaded(handler);
		}
	},
	events: {
		emit: (event, payload) => eventBus.emit(event, payload),
		on: (event, handler) => eventBus.on(event, handler)
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
	}
};

export function setupSDK() {
	initSDK(shellSDK);
}
