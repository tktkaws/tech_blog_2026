import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5';
import sharp from 'sharp';

type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

function* articleImages(parent: ParentNode): Generator<Element> {
	for (const node of parent.childNodes) {
		if (!('tagName' in node)) continue;
		if (node.tagName === 'img') yield node;
		yield* articleImages(node);
	}
}

async function firstFrame(url: URL, page: URL): Promise<string | undefined> {
	if (url.hostname === 'images.microcms-assets.io') {
		url.searchParams.delete('auto');
		url.searchParams.set('fm', 'png');
		url.searchParams.set('frame', '1');
		return url.href;
	}

	try {
		let input: Buffer;
		if (url.origin === page.origin) {
			const publicDir = resolve('public');
			const file = resolve(publicDir, `.${decodeURIComponent(url.pathname)}`);
			const path = relative(publicDir, file);
			if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) return;
			input = await readFile(file);
		} else {
			const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
			if (!response.ok) return;
			input = Buffer.from(await response.arrayBuffer());
		}
		const poster = await sharp(input, { pages: 1 }).webp({ lossless: true }).toBuffer();
		return `data:image/webp;base64,${poster.toString('base64')}`;
	} catch {
		// Keep the original GIF playable even when its poster cannot be generated.
		return undefined;
	}
}

/** Serve a still image in the HTML and load the GIF only on request. */
export async function withGifPosters(html: string, page: URL): Promise<string> {
	const fragment = parseFragment(html);
	const posters = new Map<string, Promise<string | undefined>>();
	const updates = [];
	for (const image of articleImages(fragment)) {
		const source = image.attrs.find(({ name }) => name === 'src');
		if (!source) continue;
		const url = URL.parse(source.value, page);
		if (!url || !/^(https?:|data:)$/.test(url.protocol)) continue;
		const isGif = url.protocol === 'data:'
			? /^data:image\/gif[;,]/i.test(source.value)
			: /(?:\.|%2e)gif$/i.test(url.pathname) || url.searchParams.get('fm') === 'gif';
		if (!isGif) continue;

		let poster = posters.get(url.href);
		if (!poster) {
			poster = firstFrame(url, page);
			posters.set(url.href, poster);
		}
		image.attrs.push({ name: 'data-gif-src', value: source.value });
		const picture = image.parentNode;
		const sources = picture && 'tagName' in picture && picture.tagName === 'picture'
			? picture.childNodes.filter((node): node is Element => 'tagName' in node && node.tagName === 'source')
			: [];
		for (const node of [image, ...sources]) {
			const srcset = node.attrs.find(({ name }) => name === 'srcset');
			if (srcset) srcset.name = 'data-gif-srcset';
		}
		updates.push(poster.then((still) => {
			if (still) source.value = still;
			else image.attrs = image.attrs.filter((attr) => attr !== source);
		}));
	}
	if (updates.length === 0) return html;
	await Promise.all(updates);
	return serialize(fragment);
}
