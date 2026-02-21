import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { config } from '$lib/config';

export const userManager = new UserManager({
	authority: config.oidc.authority,
	client_id: config.oidc.clientId,
	redirect_uri: config.oidc.redirectUri,
	post_logout_redirect_uri: config.oidc.postLogoutRedirectUri,
	scope: 'openid profile email groups offline_access',
	response_type: 'code',
	userStore: new WebStorageStateStore({ store: window.localStorage }),
	// Silent token renewal via hidden iframe
	automaticSilentRenew: true,
	silent_redirect_uri: `${window.location.origin}/auth/silent`
});

export async function login() {
	await userManager.signinRedirect();
}

export async function logout() {
	await userManager.signoutRedirect();
}

export async function handleCallback() {
	return await userManager.signinRedirectCallback();
}

export async function getAccessToken(): Promise<string> {
	const user = await userManager.getUser();
	if (!user || user.expired) {
		// Try silent renew before forcing re-login
		try {
			const renewed = await userManager.signinSilent();
			if (renewed?.access_token) return renewed.access_token;
		} catch {
			// silent renew failed — redirect to login
		}
		await userManager.signinRedirect();
		throw new Error('Redirecting to login');
	}
	return user.access_token;
}
