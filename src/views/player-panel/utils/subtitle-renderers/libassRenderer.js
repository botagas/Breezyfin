import {
	disposeAssRenderer,
	initAssCanvasRenderer,
	initAssRenderer,
	supportsAssRenderer
} from '../assRenderer';
import {getAssRendererDebugInfo} from '../assRendererOptions';
import {collectExternalRendererDiagnostics} from './rendererDiagnostics';
import {
	cleanupManualSubtitleRenderer,
	readVideoTime,
	setManualSubtitleCanvasRect
} from './manualCanvasLayout';

export const LIBASS_RENDERER_DEBUG = Object.freeze({
	mode: 'video-attached',
	engine: 'libass-wasm'
});

const MANUAL_SYNC_INTERVAL_MS = 250;
const MANUAL_SYNC_MIN_DELTA_SECONDS = 0.18;

export const supportsLibassRenderer = () => supportsAssRenderer();

const moveLibassCanvasParent = (renderer, containerElement) => {
	const canvasParent = renderer?.canvasParent || null;
	const canvas = renderer?.canvas || canvasParent?.querySelector?.('.libassjs-canvas') || null;
	if (!renderer || !canvasParent || !containerElement) {
		return {
			canvas,
			canvasParent,
			canvasMoved: false
		};
	}
	canvasParent.classList.add('breezyfin-libass-canvas-parent');
	if (canvas) {
		canvas.classList.add('breezyfin-libass-canvas');
	}
	if (canvasParent.parentNode !== containerElement) {
		containerElement.appendChild(canvasParent);
	}
	renderer.__breezyfinCanvas = canvas;
	renderer.__breezyfinCanvasParent = canvasParent;
	try {
		if (typeof renderer.resize === 'function') {
			renderer.resize();
		}
	} catch (error) {
		console.warn('[LibassRenderer] Error resizing moved canvas:', error);
	}
	return {
		canvas,
		canvasParent,
		canvasMoved: true
	};
};

const startManualCanvasSync = ({
	renderer,
	videoElement,
	canvas,
	containerElement
}) => {
	if (!renderer || !videoElement || !canvas || !containerElement) return () => {};
	let disposed = false;
	let intervalId = null;
	let lastSyncedTime = null;
	const syncTime = (force = false) => {
		if (disposed) return;
		const currentTime = readVideoTime(videoElement);
		if (
			!force &&
			lastSyncedTime !== null &&
			Math.abs(currentTime - lastSyncedTime) < MANUAL_SYNC_MIN_DELTA_SECONDS
		) {
			return;
		}
		try {
			if (typeof renderer.setCurrentTime === 'function') {
				renderer.setCurrentTime(currentTime);
			}
			lastSyncedTime = currentTime;
			renderer.__breezyfinManualSyncCount = (renderer.__breezyfinManualSyncCount || 0) + 1;
			renderer.__breezyfinManualSyncAtMs = Date.now();
		} catch (error) {
			console.warn('[LibassRenderer] Error syncing manual canvas time:', error);
		}
	};
	const syncPlaybackState = () => {
		if (disposed || typeof renderer.setIsPaused !== 'function') return;
		try {
			renderer.setIsPaused(videoElement.paused === true, readVideoTime(videoElement));
		} catch (error) {
			console.warn('[LibassRenderer] Error syncing manual canvas pause state:', error);
		}
	};
	const syncRate = () => {
		if (disposed || typeof renderer.setRate !== 'function') return;
		try {
			renderer.setRate(videoElement.playbackRate || 1);
		} catch (error) {
			console.warn('[LibassRenderer] Error syncing manual canvas rate:', error);
		}
	};
	const syncSize = () => setManualSubtitleCanvasRect(canvas, videoElement, containerElement, (canvasWidth, canvasHeight) => {
		if (renderer && typeof renderer.resize === 'function') {
			renderer.resize(canvasWidth, canvasHeight, 0, 0);
		}
	});
	const onPlaying = () => {
		syncPlaybackState();
		syncTime(true);
	};
	const onPause = () => {
		syncPlaybackState();
	};
	const onSeeked = () => {
		syncTime(true);
	};
	const eventHandlers = [
		['playing', onPlaying],
		['play', onPlaying],
		['pause', onPause],
		['waiting', onPause],
		['seeked', onSeeked],
		['timeupdate', syncTime],
		['ratechange', syncRate],
		['loadedmetadata', syncSize],
		['resize', syncSize]
	];
	eventHandlers.forEach(([eventName, handler]) => {
		videoElement.addEventListener(eventName, handler);
	});
	if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function') {
		renderer.__breezyfinResizeObserver = new window.ResizeObserver(syncSize);
		renderer.__breezyfinResizeObserver.observe(containerElement);
		renderer.__breezyfinResizeObserver.observe(videoElement);
	}
	syncSize();
	syncRate();
	syncPlaybackState();
	syncTime(true);
	intervalId = setInterval(syncTime, MANUAL_SYNC_INTERVAL_MS);
	return () => cleanupManualSubtitleRenderer({
		renderer,
		videoElement,
		eventHandlers,
		intervalId,
		markDisposed: () => {
			disposed = true;
		}
	});
};

export const initLibassRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent,
	onError
}) => {
	const renderer = await initAssRenderer(videoElement, {content: subtitleContent}, onError);
	const {
		canvas,
		canvasMoved
	} = moveLibassCanvasParent(renderer, containerElement);
	return {
		instance: renderer,
		debug: {
			...LIBASS_RENDERER_DEBUG,
			...getAssRendererDebugInfo(videoElement, {
				canvasElement: canvas,
				canvasMode: canvasMoved ? 'auto-moved' : 'auto-sibling'
			}),
			...collectExternalRendererDiagnostics({
				containerElement,
				videoElement,
				renderer
			}),
			libassStatus: renderer ? 'ready' : 'init-failed'
		}
	};
};

export const initLibassManualRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent,
	onError
}) => {
	if (!containerElement) {
		return {
			instance: null,
			debug: {
				...LIBASS_RENDERER_DEBUG,
				mode: 'manual-canvas',
				libassStatus: 'missing-container'
			}
		};
	}
	const canvas = document.createElement('canvas');
	canvas.className = 'breezyfin-libass-manual-canvas breezyfin-libass-canvas';
	canvas.style.position = 'absolute';
	canvas.style.pointerEvents = 'none';
	canvas.style.display = 'block';
	containerElement.appendChild(canvas);
	setManualSubtitleCanvasRect(canvas, videoElement, containerElement);
	const renderer = await initAssCanvasRenderer(canvas, {content: subtitleContent}, onError);
	if (!renderer) {
		if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
		return {
			instance: null,
			debug: {
				...LIBASS_RENDERER_DEBUG,
				mode: 'manual-canvas',
				canvasMode: 'caller-owned-manual',
				libassStatus: 'init-failed'
			}
		};
	}
	renderer.__breezyfinCanvas = canvas;
	renderer.__breezyfinCleanup = startManualCanvasSync({
		renderer,
		videoElement,
		canvas,
		containerElement
	});
	return {
		instance: renderer,
		debug: {
			...LIBASS_RENDERER_DEBUG,
			...getAssRendererDebugInfo(videoElement, {
				canvasElement: canvas,
				canvasMode: 'caller-owned-manual'
			}),
			mode: 'manual-canvas',
			manualSyncIntervalMs: MANUAL_SYNC_INTERVAL_MS,
			...collectExternalRendererDiagnostics({
				containerElement,
				videoElement,
				renderer
			}),
			libassStatus: 'ready'
		}
	};
};

export const disposeLibassRenderer = (renderer) => {
	try {
		if (typeof renderer?.__breezyfinCleanup === 'function') {
			renderer.__breezyfinCleanup();
			renderer.__breezyfinCleanup = null;
		}
	} catch (error) {
		console.warn('[LibassRenderer] Error cleaning manual canvas sync:', error);
	}
	disposeAssRenderer(renderer);
};
