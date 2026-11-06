import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { close, createIndex } from 'pagefind';
import { validateSearchIndex } from '../scripts/check-search-index.mjs';

const article = `<!doctype html>
<html lang="ja" data-pagefind-index><body>
  <header>navigationonly</header>
  <h1 data-pagefind-body data-pagefind-meta="title">タイトル専用語</h1>
  <aside>tableofcontentsonly</aside>
  <div data-pagefind-body><h2 id="body">アクセシビリティ</h2>
    <p>本文だけの検索語</p><pre><code>codeOnlyIdentifier</code></pre>
  </div>
  <aside><h1>タイトルの複製</h1>relatedarticleonly</aside>
</body></html>`;
const otherPage = '<html lang="ja"><body><h1>著者について</h1>aboutonly</body></html>';

async function withIndex(callback) {
	try {
		const { index, errors } = await createIndex({ rootSelector: 'html[data-pagefind-index]' });
		assert.deepEqual(errors, []);
		assert.ok(index);
		await callback(index);
	} finally {
		await close();
	}
}

async function fixtureDirectory(t) {
	const directory = await mkdtemp(path.join(tmpdir(), 'tech-blog-search-'));
	t.after(async () => {
		// Restrict recursive cleanup to the exact temporary directory created above.
		assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
		assert.ok(path.basename(directory).startsWith('tech-blog-search-'));
		await rm(directory, { recursive: true, force: true });
	});
	return directory;
}

test('indexes Japanese article titles, body and code without navigation or duplicate content', async () => {
	await withIndex(async (index) => {
		await index.addHTMLFile({ url: '/blog/example/', content: article });
		await index.addHTMLFile({ url: '/about/', content: otherPage });
		await index.addHTMLFile({ url: '/', content: otherPage });
		const { files, errors } = await index.getFiles();
		assert.deepEqual(errors, []);
		const entry = JSON.parse(new TextDecoder().decode(files.find((file) => file.path === 'pagefind-entry.json').content));
		assert.deepEqual(Object.keys(entry.languages), ['ja']);
		assert.equal(entry.languages.ja.page_count, 1);
		const fragments = files.filter((file) => file.path.endsWith('.pf_fragment'));
		assert.equal(fragments.length, 1);
		const fragment = JSON.parse(gunzipSync(fragments[0].content).toString().replace(/^pagefind_dcd/, ''));
		assert.equal(fragment.url, '/blog/example/');
		assert.equal(fragment.meta.title, 'タイトル専用語');
		const content = fragment.content.replaceAll('\u200b', '');
		for (const term of ['タイトル専用語', 'アクセシビリティ', '本文だけの検索語', 'codeOnlyIdentifier']) {
			assert.ok(content.includes(term), `Missing article term: ${term}`);
		}
		for (const term of ['navigationonly', 'tableofcontentsonly', 'relatedarticleonly', 'aboutonly', 'タイトルの複製']) {
			assert.ok(!content.includes(term), `Excluded content leaked into index: ${term}`);
		}
	});
});

test('does not fall back to indexing other pages when there are no articles', async () => {
	await withIndex(async (index) => {
		await index.addHTMLFile({ url: '/about/', content: otherPage });
		await index.addHTMLFile({ url: '/', content: otherPage });
		const { files, errors } = await index.getFiles();
		assert.deepEqual(errors, []);
		const entry = JSON.parse(new TextDecoder().decode(files.find((file) => file.path === 'pagefind-entry.json').content));
		assert.deepEqual(entry.languages, {});
		assert.equal(files.filter((file) => file.path.endsWith('.pf_fragment')).length, 0);
	});
});

test('build validation accepts a complete index and rejects missing bundles, wrong counts and zero articles', async (t) => {
	const directory = await fixtureDirectory(t);
	const articleDirectory = path.join(directory, 'blog', 'example');
	await mkdir(articleDirectory, { recursive: true });
	await writeFile(path.join(articleDirectory, 'index.html'), article);
	await writeFile(path.join(directory, 'index.html'), otherPage);
	await assert.rejects(validateSearchIndex(directory), /complete search bundle/);
	await withIndex(async (index) => {
		assert.deepEqual((await index.addDirectory({ path: directory })).errors, []);
		assert.deepEqual((await index.writeFiles({ outputPath: path.join(directory, 'pagefind') })).errors, []);
	});
	assert.equal(await validateSearchIndex(directory), 1);

	const entryPath = path.join(directory, 'pagefind', 'pagefind-entry.json');
	const entry = JSON.parse(await readFile(entryPath, 'utf8'));
	entry.languages.ja.page_count = 2;
	await writeFile(entryPath, JSON.stringify(entry));
	await assert.rejects(validateSearchIndex(directory), /exactly 1 Japanese articles/);
	await writeFile(path.join(articleDirectory, 'index.html'), otherPage);
	await assert.rejects(validateSearchIndex(directory), /at least one searchable article/);
});
