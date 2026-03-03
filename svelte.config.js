import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		experimental: {
			remoteFunctions: true
		}
	},

	compilerOptions: {
		experimental: {
			async: true,
		},
		runes: true
	}
};

export default config;
