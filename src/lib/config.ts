// Runtime config — values are injected via environment variables at build time.
// In Docker, pass these as VITE_* build args.

export const config = {
	oidc: {
		authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:9000/application/o/fuzzypeanut/',
		clientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'fuzzypeanut-shell',
		redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? 'http://localhost:5173/auth/callback',
		postLogoutRedirectUri: import.meta.env.VITE_OIDC_POST_LOGOUT_URI ?? 'http://localhost:5173/'
	},
	registry: {
		url: import.meta.env.VITE_REGISTRY_URL ?? 'http://localhost:3100'
	}
} as const;
