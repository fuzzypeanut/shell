import type { Theme } from '@fuzzypeanut/sdk';

const DEFAULT_THEME: Theme = {
	mode: 'light',
	primaryColor: '#5b4fcf',
	surfaceColor: '#ffffff',
	textColor: '#1a1a2e'
};

class ThemeStore {
	current = $state<Theme>(DEFAULT_THEME);
	#listeners = new Set<(t: Theme) => void>();

	constructor() {
		// Restore persisted preference
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('fp-theme-mode');
			if (stored === 'dark') this.setMode('dark');
		}
	}

	setMode(mode: 'light' | 'dark') {
		this.current = {
			...this.current,
			mode,
			surfaceColor: mode === 'dark' ? '#1a1a2e' : '#ffffff',
			textColor: mode === 'dark' ? '#e8e8f0' : '#1a1a2e'
		};
		localStorage.setItem('fp-theme-mode', mode);
		document.documentElement.setAttribute('data-theme', mode);
		this.#listeners.forEach((cb) => cb(this.current));
	}

	getCurrent() {
		return this.current;
	}

	onChange(cb: (theme: Theme) => void): () => void {
		this.#listeners.add(cb);
		return () => this.#listeners.delete(cb);
	}
}

export const theme = new ThemeStore();
