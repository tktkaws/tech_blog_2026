// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import { validateSearchIndex } from './scripts/check-search-index.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	redirects: {
		'/blog': '/',
	},
	integrations: [
		mdx(),
		sitemap(),
		pagefind({
			indexConfig: {
				rootSelector: 'html[data-pagefind-index]',
			},
		}),
		{
			name: 'validate-search-index',
			hooks: {
				'astro:build:done': async ({ dir, logger }) => {
					const count = await validateSearchIndex(dir);
					logger.info(`Verified search index for ${count} Japanese articles`);
				},
			},
		},
	],
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-dark-high-contrast',
				dark: 'github-dark-high-contrast',
			},
		},
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
