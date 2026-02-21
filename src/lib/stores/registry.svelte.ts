import { config } from '$lib/config';
import type { ModuleInfo } from '@fuzzypeanut/sdk';

class RegistryStore {
	modules = $state<ModuleInfo[]>([]);
	#listeners = new Map<string, Set<(mod: ModuleInfo) => void>>();
	#removeListeners = new Map<string, Set<() => void>>();

	async load() {
		try {
			const res = await fetch(`${config.registry.url}/modules`);
			if (!res.ok) throw new Error(`Registry responded ${res.status}`);
			const data: ModuleInfo[] = await res.json();
			for (const mod of data) {
				this.#addModule(mod);
			}
		} catch (err) {
			console.warn('[FuzzyPeanut] Could not reach registry:', err);
		}
	}

	#addModule(mod: ModuleInfo) {
		if (!this.modules.find((m) => m.id === mod.id)) {
			this.modules = [...this.modules, mod];
			this.#listeners.get(mod.id)?.forEach((cb) => cb(mod));
		}
	}

	#removeModule(id: string) {
		this.modules = this.modules.filter((m) => m.id !== id);
		this.#removeListeners.get(id)?.forEach((cb) => cb());
	}

	getModules() {
		return this.modules;
	}

	hasModule(id: string) {
		return this.modules.some((m) => m.id === id);
	}

	onModuleInstalled(id: string, cb: (mod: ModuleInfo) => void): () => void {
		if (!this.#listeners.has(id)) this.#listeners.set(id, new Set());
		this.#listeners.get(id)!.add(cb);
		return () => this.#listeners.get(id)?.delete(cb);
	}

	onModuleRemoved(id: string, cb: () => void): () => void {
		if (!this.#removeListeners.has(id)) this.#removeListeners.set(id, new Set());
		this.#removeListeners.get(id)!.add(cb);
		return () => this.#removeListeners.get(id)?.delete(cb);
	}

	// Called by the registry service via SSE or polling to notify of changes
	handleEvent(event: { type: 'added' | 'removed'; module: ModuleInfo }) {
		if (event.type === 'added') this.#addModule(event.module);
		else this.#removeModule(event.module.id);
	}
}

export const registry = new RegistryStore();
