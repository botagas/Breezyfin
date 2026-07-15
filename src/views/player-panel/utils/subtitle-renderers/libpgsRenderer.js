import {supportsLibpgsRuntime} from './rendererSupport';
import {buildAppAssetUrl} from './assetUrls';

const LIBPGS_STATIC_ASSET_BASE = 'node_modules/breezyfin-subtitle-assets/libpgs';

const createCanvas = (containerElement) => {
	if (!containerElement || typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	canvas.setAttribute('aria-hidden', 'true');
	canvas.style.position = 'absolute';
	canvas.style.inset = '0';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.pointerEvents = 'none';
	canvas.style.objectFit = 'contain';
	canvas.style.zIndex = 'auto';
	containerElement.appendChild(canvas);
	return canvas;
};

const normalizeErrorMessage = (error) => (
	error?.message || String(error || 'unknown-error')
);

export const initLibpgsRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent,
	subtitleUrl,
	sourceFormat = 'sup',
	onError
} = {}) => {
	if (!supportsLibpgsRuntime()) {
		return {
			instance: null,
			debug: {
				engine: 'libpgs',
				status: 'unsupported-runtime',
				sourceFormat
			}
		};
	}
	if (!videoElement || (!subtitleContent && !subtitleUrl)) {
		return {
			instance: null,
			debug: {
				engine: 'libpgs',
				status: 'missing-context',
				sourceFormat
			}
		};
	}
	try {
		const adapter = require('libpgs');
		const Renderer = adapter?.PgsRenderer || adapter?.default?.PgsRenderer;
		if (typeof Renderer !== 'function') {
			return {
				instance: null,
				debug: {
					engine: 'libpgs',
					status: 'missing-renderer-export',
					sourceFormat
				}
			};
		}
		const canvas = createCanvas(containerElement);
		const workerUrl = buildAppAssetUrl(`${LIBPGS_STATIC_ASSET_BASE}/libpgs.worker.js`);
		const renderer = new Renderer({
			video: videoElement,
			canvas: canvas || undefined,
			workerUrl,
			subUrl: subtitleContent instanceof ArrayBuffer ? undefined : subtitleUrl,
			aspectRatio: 'fill'
		});
		if (subtitleContent instanceof ArrayBuffer && typeof renderer.loadFromBuffer === 'function') {
			renderer.loadFromBuffer(subtitleContent);
		}
		renderer.__breezyfinCanvas = canvas || renderer.canvas || null;
		renderer.__breezyfinWorkerUrl = workerUrl;
		renderer.__breezyfinBitmapDiagnostics = {
			engine: 'libpgs',
			status: 'ready',
			mode: canvas ? 'custom-canvas' : 'video-attached',
			sourceFormat,
			bitmapBackend: 'libpgs',
			bitmapSource: subtitleContent instanceof ArrayBuffer ? 'arraybuffer' : 'url',
			bitmapBytes: subtitleContent instanceof ArrayBuffer ? subtitleContent.byteLength : null,
			workerUrl
		};
		renderer.__breezyfinCleanup = () => {
			if (canvas?.parentNode) {
				canvas.parentNode.removeChild(canvas);
			}
		};
		renderer.__breezyfinGetDiagnostics = () => ({
			bitmapBackend: 'libpgs',
			bitmapSource: subtitleContent instanceof ArrayBuffer ? 'arraybuffer' : 'url',
			bitmapBytes: subtitleContent instanceof ArrayBuffer ? subtitleContent.byteLength : null,
			workerUrl
		});
		return {
			instance: renderer,
			debug: {
				...renderer.__breezyfinBitmapDiagnostics,
				readyStatus: 'ready'
			}
		};
	} catch (error) {
		if (typeof onError === 'function') onError(error);
		return {
			instance: null,
			debug: {
				engine: 'libpgs',
				status: 'init-error',
				sourceFormat,
				error: normalizeErrorMessage(error)
			}
		};
	}
};
