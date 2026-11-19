/** Request the original microCMS image without changing other image transformations. */
function expandedImageSource(source: string): string {
	const url = new URL(source, document.baseURI);
	if (url.hostname === 'images.microcms-assets.io') {
		url.searchParams.delete('w');
		url.searchParams.delete('h');
	}
	return url.href;
}

type GifControl = {
	button: HTMLButtonElement;
	readonly source: string;
	toggle: () => void;
};

function addGifControl(image: HTMLImageElement, group: HTMLElement, signal: AbortSignal): GifControl | undefined {
	const gif = image.dataset.gifSrc;
	if (!gif) return;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'gif-toggle';
	button.textContent = 'GIFを再生';

	const picture = image.closest('picture');
	const still = image.getAttribute('src');
	const sources = [image, ...(picture?.querySelectorAll('source[data-gif-srcset]') ?? [])];
	let playing = false;
	const setPlaying = (next: boolean) => {
		playing = next;
		for (const source of sources) {
			const srcset = source.getAttribute('data-gif-srcset');
			if (playing && srcset !== null) source.setAttribute('srcset', srcset);
			else source.removeAttribute('srcset');
		}
		if (playing) image.setAttribute('src', gif);
		else if (still !== null) image.setAttribute('src', still);
		else image.removeAttribute('src');
		button.textContent = playing ? 'GIFを停止' : 'GIFを再生';
	};

	const toggle = () => setPlaying(!playing);
	button.addEventListener('click', toggle, { signal });
	signal.addEventListener('abort', () => {
		if (playing) setPlaying(false);
		button.remove();
	}, { once: true });
	group.append(button);
	return {
		button,
		toggle,
		get source() {
			return image.src;
		},
	};
}

class ImageLightbox extends HTMLElement {
	private controller?: AbortController;
	private restoreScroll?: () => void;

	connectedCallback() {
		const article = this.closest('article');
		const dialog = this.querySelector('dialog');
		const preview = this.querySelector('img');
		const closeButton = this.querySelector('.image-lightbox__close');
		const status = this.querySelector('[role="status"]');
		const gifToggle = this.querySelector<HTMLButtonElement>('.image-lightbox__gif-toggle');
		if (!article || !dialog || !preview || !closeButton || !status || !gifToggle) return;

		this.controller?.abort();
		this.controller = new AbortController();
		const { signal } = this.controller;
		let opener: HTMLButtonElement | null = null;
		let fallbackSource = '';
		let activeGif: GifControl | undefined;
		const gifControls = new Map<HTMLImageElement, GifControl>();

		article.querySelectorAll<HTMLImageElement>('.markdown-body img').forEach((image) => {
			// Keep links and existing interactive content working as authored.
			const interactive = image.closest('a, button, [role="button"], [contenteditable]');
			let target = interactive ?? image.closest('picture') ?? image;
			if (!interactive) {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'image-lightbox-trigger';
				button.setAttribute('aria-label', image.alt.trim() ? `画像を拡大: ${image.alt}` : '画像を拡大');
				button.setAttribute('aria-haspopup', 'dialog');
				button.setAttribute('aria-controls', dialog.id);
				target.replaceWith(button);
				button.append(target);
				target = button;
			}

			let group = target.parentElement;
			if (!group?.classList.contains('article-image')) {
				group = document.createElement('span');
				group.className = 'article-image';
				target.replaceWith(group);
				group.append(target);
			}
			const control = addGifControl(image, group, signal);
			if (control) gifControls.set(image, control);
		});

		const setPreviewSource = (source: string) => {
			fallbackSource = source;
			if (source) {
				status.textContent = '画像を読み込んでいます…';
				preview.src = expandedImageSource(source);
			} else {
				preview.removeAttribute('src');
				preview.hidden = true;
				status.textContent = '';
			}
		};

		article.addEventListener('click', (event) => {
			if (!(event.target instanceof Element) || dialog.open) return;
			const button = event.target.closest<HTMLButtonElement>('.image-lightbox-trigger');
			const image = button?.querySelector('img');
			if (!button || !image) return;
			const control = gifControls.get(image);
			const source = control?.source ?? (image.currentSrc || image.src);
			if (!source && !control) return;

			opener = button;
			activeGif = control;
			gifToggle.hidden = !activeGif;
			if (control) gifToggle.textContent = control.button.textContent;
			preview.alt = image.alt;
			preview.hidden = true;
			dialog.showModal();

			const root = document.documentElement;
			const body = document.body;
			const rootOverflow = root.style.getPropertyValue('overflow');
			const rootPriority = root.style.getPropertyPriority('overflow');
			const bodyOverflow = body.style.getPropertyValue('overflow');
			const bodyPriority = body.style.getPropertyPriority('overflow');
			root.style.setProperty('overflow', 'hidden');
			body.style.setProperty('overflow', 'hidden');
			this.restoreScroll = () => {
				root.style.setProperty('overflow', rootOverflow, rootPriority);
				body.style.setProperty('overflow', bodyOverflow, bodyPriority);
			};
			setPreviewSource(source);
		}, { signal });

		gifToggle.addEventListener('click', () => {
			if (!activeGif) return;
			activeGif.toggle();
			gifToggle.textContent = activeGif.button.textContent;
			setPreviewSource(activeGif.source);
		}, { signal });

		preview.addEventListener('load', () => {
			if (!dialog.open) return;
			preview.hidden = false;
			status.textContent = '';
		}, { signal });

		preview.addEventListener('error', () => {
			if (!dialog.open) return;
			if (preview.src !== fallbackSource) {
				preview.src = fallbackSource;
				return;
			}
			preview.hidden = true;
			status.textContent = '画像を読み込めませんでした。閉じてからもう一度お試しください。';
		}, { signal });

		closeButton.addEventListener('click', () => dialog.close(), { signal });
		preview.addEventListener('click', () => dialog.close(), { signal });
		// Only dismiss when both ends of the pointer interaction are on the background.
		let backgroundPress = false;
		const isBackground = (target: EventTarget | null) =>
			target instanceof Element && !target.closest('button, img, .image-lightbox__status');
		dialog.addEventListener('pointerdown', (event) => {
			backgroundPress = event.button === 0 && isBackground(event.target);
		}, { signal });
		dialog.addEventListener('click', (event) => {
			if (backgroundPress && isBackground(event.target)) dialog.close();
			backgroundPress = false;
		}, { signal });

		// Native dialog handles Escape and keeps keyboard focus inside the modal.
		dialog.addEventListener('close', () => {
			this.restoreScroll?.();
			this.restoreScroll = undefined;
			preview.removeAttribute('src');
			preview.hidden = true;
			gifToggle.hidden = true;
			status.textContent = '';
			activeGif = undefined;
			if (opener?.isConnected) opener.focus({ preventScroll: true });
			opener = null;
		}, { signal });
	}

	disconnectedCallback() {
		this.controller?.abort();
		this.querySelector('dialog')?.close();
		this.restoreScroll?.();
		this.restoreScroll = undefined;
	}
}

if (!customElements.get('image-lightbox')) {
	customElements.define('image-lightbox', ImageLightbox);
}
