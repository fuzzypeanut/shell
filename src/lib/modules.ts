import type { ModuleInfo } from '@fuzzypeanut/sdk';

/**
 * The interface every FuzzyPeanut module must export as its default.
 * Modules use their own bundled Svelte runtime to mount into the target div —
 * no cross-Svelte-instance rendering, no fragile component interop.
 */
export interface FPModule {
	mount(target: HTMLElement, props?: Record<string, unknown>): unknown;
	unmount(instance: unknown): void;
}

const cache = new Map<string, FPModule>();

/**
 * Load a module's remoteEntry.js and return its FPModule interface.
 * Safe to call multiple times — cached after first load.
 */
export async function loadModule(mod: ModuleInfo): Promise<FPModule> {
	if (cache.has(mod.id)) return cache.get(mod.id)!;

	// @vite-ignore — dynamic import from an external URL
	const remote = await import(/* @vite-ignore */ mod.remoteEntry);
	const fpmod: FPModule = remote.default ?? remote;

	if (typeof fpmod?.mount !== 'function') {
		throw new Error(
			`[FuzzyPeanut] Module "${mod.id}" remoteEntry does not export { mount, unmount }. ` +
			'See https://github.com/fuzzypeanut/sdk for the module contract.'
		);
	}

	cache.set(mod.id, fpmod);
	return fpmod;
}

export function evictModule(id: string) {
	cache.delete(id);
}
