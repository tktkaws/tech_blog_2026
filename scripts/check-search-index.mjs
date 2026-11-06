import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function countSearchablePages(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const counts = await Promise.all(entries.map(async (entry) => {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'pagefind' || entry.name === '_astro') return 0;
			return countSearchablePages(filename);
		}
		if (!entry.isFile() || !entry.name.endsWith('.html')) return 0;
		const html = await readFile(filename, 'utf8');
		return /<html\b[^>]*\bdata-pagefind-index(?:\s|=|>)/i.test(html) ? 1 : 0;
	}));
	return counts.reduce((sum, count) => sum + count, 0);
}

/** Fail the Astro build if Pagefind only logged an error or emitted an incomplete index. */
export async function validateSearchIndex(directory) {
	const outputDirectory = directory instanceof URL ? fileURLToPath(directory) : directory;
	const expectedCount = await countSearchablePages(outputDirectory);
	if (expectedCount === 0) {
		throw new Error('Search index requires at least one searchable article. No index was published.');
	}

	const bundleDirectory = path.join(outputDirectory, 'pagefind');
	let entry;
	try {
		entry = JSON.parse(await readFile(path.join(bundleDirectory, 'pagefind-entry.json'), 'utf8'));
		const script = await stat(path.join(bundleDirectory, 'pagefind.js'));
		if (!script.isFile() || script.size === 0) throw new Error('Missing Pagefind script');
	} catch (cause) {
		throw new Error('Pagefind did not generate a complete search bundle.', { cause });
	}

	const language = entry.languages?.ja;
	if (Object.keys(entry.languages ?? {}).length !== 1 || language?.page_count !== expectedCount) {
		throw new Error(`Search index must contain exactly ${expectedCount} Japanese articles.`);
	}
	for (const filename of [
		`pagefind.${language.hash}.pf_meta`,
		`wasm.${language.wasm ?? 'unknown'}.pagefind`,
		'pagefind-worker.js',
	]) {
		const file = await stat(path.join(bundleDirectory, filename));
		if (!file.isFile() || file.size === 0) {
			throw new Error(`Pagefind did not generate a complete search asset: ${filename}`);
		}
	}
	return expectedCount;
}
