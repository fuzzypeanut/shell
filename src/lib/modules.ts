import type { ModuleInfo } from '@fuzzypeanut/sdk';

const cache = new Map<string, unknown>();

/**
 * Dynamically load a module's Svelte component from its remoteEntry URL.
 *
 * The module's remoteEntry.js must be a standard ES module with a default
 * export of the top-level Svelte component. The shell SDK is available on
 * window.__fuzzyPeanutSDK before this import fires, so modules can call
 * getSDK() from @fuzzypeanut/sdk without any additional setup.
 *
 * Safe to call multiple times — cached after first load.
 */
export async function loadModule(mod: ModuleInfo): Promise<unknown> {
	if (cache.has(mod.id)) return cache.get(mod.id);

	// Dynamic import from an external URL.
	// @vite-ignore suppresses Vite's warning about non-static import expressions.
	const remote = await import(/* @vite-ignore */ mod.remoteEntry);
	const component = remote.default ?? remote;

	cache.set(mod.id, component);
	return component;
}

export function evictModule(id: string) {
	cache.delete(id);
}
