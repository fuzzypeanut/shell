import { userManager, login } from '$lib/auth/oidc';
import type { User as OidcUser } from 'oidc-client-ts';
import type { User } from '@fuzzypeanut/sdk';

function toUser(oidcUser: OidcUser): User {
	return {
		id: oidcUser.profile.sub,
		email: oidcUser.profile.email ?? '',
		name: oidcUser.profile.name ?? oidcUser.profile.preferred_username ?? '',
		avatarUrl: oidcUser.profile.picture,
		groups: (oidcUser.profile['groups'] as string[]) ?? []
	};
}

class AuthStore {
	user = $state<User | null>(null);
	loading = $state(true);

	async init() {
		const oidcUser = await userManager.getUser();
		if (oidcUser && !oidcUser.expired) {
			this.user = toUser(oidcUser);
		} else {
			// Not logged in — redirect to Authentik
			await login();
		}
		this.loading = false;

		// Keep in sync with silent renewals and cross-tab changes
		userManager.events.addUserLoaded((u) => {
			this.user = toUser(u);
		});
		userManager.events.addUserUnloaded(() => {
			this.user = null;
		});
	}
}

export const auth = new AuthStore();
