type Handler = (payload: unknown) => void;

class EventBus {
	#handlers = new Map<string, Set<Handler>>();

	emit(event: string, payload?: unknown) {
		this.#handlers.get(event)?.forEach((h) => {
			try {
				h(payload);
			} catch (err) {
				console.error(`[FuzzyPeanut] Event handler error for "${event}":`, err);
			}
		});
	}

	on(event: string, handler: Handler): () => void {
		if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
		this.#handlers.get(event)!.add(handler);
		return () => this.#handlers.get(event)?.delete(handler);
	}
}

export const eventBus = new EventBus();
