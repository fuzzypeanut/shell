import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Serve index.html for all unmatched paths (SPA mode)
			fallback: 'index.html'
		})
	}
};

export default config;
