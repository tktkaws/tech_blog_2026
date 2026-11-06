// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

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
