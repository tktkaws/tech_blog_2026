/** Request the original microCMS image without changing other image transformations. */
function expandedImageSource(image: HTMLImageElement): string {
	const source = image.currentSrc || image.src;
	const url = new URL(source, document.baseURI);
	if (url.hostname === 'images.microcms-assets.io') {
		url.searchParams.delete('w');
		url.searchParams.delete('h');
	}
	return url.href;
}

class ImageLightbox extends HTMLElement {
	private controller?: AbortController;
	private restoreScroll?: () => void;

	connectedCallback() {
		const article = this.closest('article');
		const dialog = this.querySelector('dialog');
		const preview = this.querySelector('img');
		const closeButton = this.querySelector('button');
		const status = this.querySelector('[role="status"]');
		if (!article || !dialog || !preview || !closeButton || !status) return;

		this.controller?.abort();
		this.controller = new AbortController();
		const { signal } = this.controller;
		let opener: HTMLButtonElement | null = null;
		let fallbackSource = '';

		article.querySelectorAll<HTMLImageElement>('.markdown-body img').forEach((image) => {
			// Keep links and existing interactive content working as authored.
			if (image.closest('a, button, [role="button"], [contenteditable]')) return;
			const target = image.closest('picture') || image;
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'image-lightbox-trigger';
			button.setAttribute('aria-label', image.alt.trim() ? `画像を拡大: ${image.alt}` : '画像を拡大');
			button.setAttribute('aria-haspopup', 'dialog');
			button.setAttribute('aria-controls', dialog.id);
			target.replaceWith(button);
			button.append(target);
		});

		article.addEventListener('click', (event) => {
			if (!(event.target instanceof Element) || dialog.open) return;
			const button = event.target.closest<HTMLButtonElement>('.image-lightbox-trigger');
			const image = button?.querySelector('img');
			if (!button || !image) return;

			opener = button;
			fallbackSource = image.currentSrc || image.src;
			preview.alt = image.alt;
			preview.hidden = true;
			status.textContent = '画像を読み込んでいます…';
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
			preview.src = expandedImageSource(image);
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
			status.textContent = '';
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
