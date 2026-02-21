import type { Notification } from '@fuzzypeanut/sdk';

let _nextId = 1;

class NotificationsStore {
	items = $state<Required<Notification>[]>([]);

	push(notification: Notification) {
		const item: Required<Notification> = {
			id: notification.id ?? `n${_nextId++}`,
			type: notification.type,
			title: notification.title,
			message: notification.message ?? '',
			duration: notification.duration ?? 4000,
			actions: notification.actions ?? []
		};
		this.items = [...this.items, item];
		if (item.duration > 0) {
			setTimeout(() => this.dismiss(item.id), item.duration);
		}
	}

	dismiss(id: string) {
		this.items = this.items.filter((n) => n.id !== id);
	}
}

export const notifications = new NotificationsStore();
