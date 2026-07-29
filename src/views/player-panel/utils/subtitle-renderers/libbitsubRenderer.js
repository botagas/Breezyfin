import {supportsLibbitsubRuntime} from './rendererSupport';

const BITMAP_CACHE_LIMIT = 24;
const BITMAP_PREFETCH_WINDOW = Object.freeze({before: 1, after: 2});

const normalizeErrorMessage = (error) => (
	error?.message || String(error || 'unknown-error')
);

const getRendererDiagnostics = (renderer) => {
	if (!renderer) return {};
	let stats = null;
	let cache = null;
	let metadata = null;
	let cue = null;
	let lastRender = null;
	try {
		stats = typeof renderer.getStats === 'function' ? renderer.getStats() : null;
		cache = typeof renderer.getCacheStats === 'function' ? renderer.getCacheStats() : null;
		metadata = typeof renderer.getMetadata === 'function' ? renderer.getMetadata() : null;
		cue = typeof renderer.getCurrentCueMetadata === 'function' ? renderer.getCurrentCueMetadata() : null;
		lastRender = typeof renderer.getLastRenderInfo === 'function' ? renderer.getLastRenderInfo() : null;
	} catch (error) {
		return {
			bitmapDiagnosticError: normalizeErrorMessage(error)
		};
	}
	return {
		bitmapCueCount: Number.isFinite(metadata?.cueCount) ? metadata.cueCount : null,
		bitmapScreen: metadata?.screenWidth && metadata?.screenHeight
			? `${metadata.screenWidth}x${metadata.screenHeight}`
			: '',
		bitmapBackend: lastRender?.backend || renderer.__breezyfinBitmapBackend || '',
		bitmapCurrentCue: Number.isFinite(cue?.index) ? cue.index : null,
		bitmapCache: cache ? `${cache.cachedFrames}/${cache.cacheLimit}` : '',
		bitmapWorker: cache?.usingWorker === true ? 'yes' : (cache?.usingWorker === false ? 'no' : ''),
		bitmapFrames: Number.isFinite(stats?.framesRendered) ? stats.framesRendered : null,
		bitmapDropped: Number.isFinite(stats?.framesDropped) ? stats.framesDropped : null,
		bitmapLastStatus: lastRender?.status || '',
		bitmapLastRenderMs: Number.isFinite(lastRender?.renderDuration) ? Math.round(lastRender.renderDuration) : null
	};
};

export const initLibbitsubRenderer = async ({
	videoElement,
	subtitleContent,
	subtitleUrl,
	sourceFormat = 'sup',
	onLoaded,
	onError
} = {}) => {
	if (!supportsLibbitsubRuntime()) {
		return {
			instance: null,
			debug: {
				engine: 'libbitsub',
				status: 'unsupported-runtime',
				sourceFormat
			}
		};
	}
	if (!videoElement || !(subtitleContent instanceof ArrayBuffer || subtitleUrl)) {
		return {
			instance: null,
			debug: {
				engine: 'libbitsub',
				status: 'missing-context',
				sourceFormat
			}
		};
	}
	try {
		const adapter = require('libbitsub');
		const Renderer = adapter?.PgsRenderer || adapter?.PGSRenderer;
		if (typeof Renderer !== 'function') {
			return {
				instance: null,
				debug: {
					engine: 'libbitsub',
					status: 'missing-renderer-export',
					sourceFormat
				}
			};
		}
		let renderer = null;
		const debug = {
			engine: 'libbitsub',
			status: 'initializing',
			mode: 'video-attached',
			sourceFormat,
			bitmapBackend: '',
			bitmapSource: subtitleContent instanceof ArrayBuffer ? 'arraybuffer' : 'url',
			bitmapBytes: subtitleContent instanceof ArrayBuffer ? subtitleContent.byteLength : null
		};
		renderer = new Renderer({
			video: videoElement,
			subContent: subtitleContent instanceof ArrayBuffer ? subtitleContent : undefined,
			subUrl: subtitleContent instanceof ArrayBuffer ? undefined : subtitleUrl,
			debug: true,
			cacheLimit: BITMAP_CACHE_LIMIT,
			prefetchWindow: BITMAP_PREFETCH_WINDOW,
			displaySettings: {
				aspectMode: 'stretch',
				safeArea: 0,
				bottomPadding: 0,
				opacity: 1
			},
			onLoaded: () => {
				renderer.__breezyfinBitmapLoaded = true;
				renderer.__breezyfinBitmapDiagnostics = {
					...(renderer.__breezyfinBitmapDiagnostics || {}),
					status: 'loaded'
				};
				const diagnostics = getRendererDiagnostics(renderer);
				if (Number.isFinite(diagnostics.bitmapCueCount) && diagnostics.bitmapCueCount <= 0) {
					const error = new Error('bitmap-renderer-empty-output');
					renderer.__breezyfinBitmapError = normalizeErrorMessage(error);
					if (typeof onError === 'function') onError(error);
					return;
				}
				if (typeof onLoaded === 'function') onLoaded(renderer);
			},
			onError: (error) => {
				renderer.__breezyfinBitmapError = normalizeErrorMessage(error);
				if (typeof onError === 'function') onError(error);
			},
			onWarning: (warning) => {
				renderer.__breezyfinBitmapWarning = warning?.message || String(warning || '');
			},
			onWebGPUFallback: () => {
				renderer.__breezyfinBitmapBackend = 'webgl2-or-canvas2d';
			},
			onWebGL2Fallback: () => {
				renderer.__breezyfinBitmapBackend = 'canvas2d';
			},
			onEvent: (event) => {
				if (event?.type === 'renderer-change') {
					renderer.__breezyfinBitmapBackend = event.renderer;
				}
				renderer.__breezyfinBitmapLastEvent = event?.type || '';
			}
		});
		renderer.__breezyfinCanvas = renderer.canvas || null;
		renderer.__breezyfinBitmapDiagnostics = debug;
		renderer.__breezyfinGetDiagnostics = () => getRendererDiagnostics(renderer);
		return {
			instance: renderer,
			debug: {
				...debug,
				status: 'ready',
				readyStatus: 'ready'
			}
		};
	} catch (error) {
		return {
			instance: null,
			debug: {
				engine: 'libbitsub',
				status: 'init-error',
				sourceFormat,
				error: normalizeErrorMessage(error)
			}
		};
	}
};
