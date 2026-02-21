<script lang="ts">
	import { onMount } from 'svelte';
	import { userManager } from '$lib/auth/oidc';

	onMount(async () => {
		try {
			await userManager.signinSilentCallback();
		} catch (e) {
			// Errors here are expected when the iframe is probing — the parent
			// window handles failures. Just log so it's visible in dev tools.
			console.debug('[FuzzyPeanut] Silent renew callback:', e);
		}
	});
</script>

<!-- Intentionally blank — this page runs in a hidden iframe for OIDC silent token renewal. -->
