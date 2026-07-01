import {collectExternalRendererDiagnostics} from './rendererDiagnostics';
import {
	supportsJassubManualRuntime,
	supportsJassubRuntime
} from './rendererSupport';
import {
	applyManualSubtitleCanvasStyle,
	cleanupManualSubtitleRenderer,
	getManualSubtitleCanvasRect,
	readVideoTime,
	setManualSubtitleCanvasRect
} from './manualCanvasLayout';

const JASSUB_OPTIONS = Object.freeze({
	prescaleFactor: 1,
	prescaleHeightLimit: 1080,
	maxRenderHeight: 0
});
const JASSUB_FALLBACK_FONT_NAME = 'breezyfin subtitle fallback';
const JASSUB_FALLBACK_FONT_URL = 'breezyfin-subtitle-fallback.ttf';
const JASSUB_AVAILABLE_FONTS = Object.freeze({
	[JASSUB_FALLBACK_FONT_NAME]: JASSUB_FALLBACK_FONT_URL,
	arial: JASSUB_FALLBACK_FONT_URL,
	'arial regular': JASSUB_FALLBACK_FONT_URL,
	roboto: JASSUB_FALLBACK_FONT_URL,
	'roboto medium': JASSUB_FALLBACK_FONT_URL,
	'sans-serif': JASSUB_FALLBACK_FONT_URL,
	'museo sans': JASSUB_FALLBACK_FONT_URL
});
const JASSUB_READY_TIMEOUT_MS = 10000;
const JASSUB_MANUAL_SYNC_INTERVAL_MS = 100;
const JASSUB_MANUAL_SYNC_MIN_DELTA_SECONDS = 0.04;
const JASSUB_MANUAL_RENDER_TIMEOUT_MS = 2500;

const truncateDiagnosticText = (value, maxLength = 80) => {
	const text = String(value || '').trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1)}…`;
};

const summarizeAssEvent = (event) => {
	if (!event || typeof event !== 'object') return '-';
	const start = event.Start ?? event.start ?? event.startTime ?? '-';
	const duration = event.Duration ?? event.duration ?? event.End ?? event.end ?? '-';
	const style = event.Style ?? event.style ?? '-';
	const text = event.Text ?? event.text ?? '';
	return truncateDiagnosticText(`s=${start} d=${duration} style=${style} text=${text}`);
};

const summarizeAssStyle = (style) => {
	if (!style || typeof style !== 'object') return '-';
	const name = style.Name ?? style.name ?? '-';
	const font = style.FontName ?? style.fontName ?? style.Fontname ?? '-';
	const size = style.FontSize ?? style.fontSize ?? '-';
	return truncateDiagnosticText(`${name}/${font}/${size}`);
};

const countActiveAssEvents = (events, currentTimeSeconds) => {
	if (!Array.isArray(events) || !Number.isFinite(currentTimeSeconds)) return 0;
	return events.reduce((count, event) => {
		const startSeconds = Number(event?.startSeconds);
		const endSeconds = Number(event?.endSeconds);
		if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return count;
		return currentTimeSeconds >= startSeconds && currentTimeSeconds <= endSeconds
			? count + 1
			: count;
	}, 0);
};

const findActiveAssEvent = (events, currentTimeSeconds) => {
	if (!Array.isArray(events) || !Number.isFinite(currentTimeSeconds)) return null;
	return events.find((event) => {
		const startSeconds = Number(event?.startSeconds);
		const endSeconds = Number(event?.endSeconds);
		if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return false;
		return currentTimeSeconds >= startSeconds && currentTimeSeconds <= endSeconds;
	}) || null;
};

const parseAssTimeToSeconds = (value) => {
	const match = String(value || '').trim().match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.](\d{1,3}))?$/);
	if (!match) return null;
	const [, hours, minutes, seconds, fraction = '0'] = match;
	const centiseconds = Number(fraction.padEnd(2, '0').slice(0, 2));
	const total = (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds) + (centiseconds / 100);
	return Number.isFinite(total) ? total : null;
};

const splitAssColumns = (value, expectedColumns) => {
	const text = String(value || '');
	if (!(expectedColumns > 1)) return [text];
	const columns = [];
	let start = 0;
	for (let index = 0; index < text.length && columns.length < expectedColumns - 1; index += 1) {
		if (text[index] === ',') {
			columns.push(text.slice(start, index).trim());
			start = index + 1;
		}
	}
	columns.push(text.slice(start).trim());
	return columns;
};

const getAssSectionName = (line) => {
	const match = line.match(/^\s*\[(.+)]\s*$/);
	return match ? match[1].toLowerCase() : '';
};

const getAssFormatColumns = (line) => String(line || '')
	.replace(/^format\s*:/i, '')
	.split(',')
	.map((column) => column.trim())
	.filter(Boolean);

const mapAssValues = (columns, values) => columns.reduce((mapped, column, index) => {
	mapped[column] = values[index] ?? '';
	return mapped;
}, {});

const parseAssSourceDiagnostics = (subtitleContent) => {
	const lines = String(subtitleContent || '').split(/\r?\n/);
	let section = '';
	let eventFormat = [];
	let styleFormat = [];
	const events = [];
	const styles = [];
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith(';')) continue;
		const sectionName = getAssSectionName(line);
		if (sectionName) {
			section = sectionName;
			continue;
		}
		if (/^format\s*:/i.test(line)) {
			if (section.includes('events')) eventFormat = getAssFormatColumns(line);
			if (section.includes('styles')) styleFormat = getAssFormatColumns(line);
			continue;
		}
		if (section.includes('styles') && /^style\s*:/i.test(line) && styleFormat.length > 0) {
			const values = splitAssColumns(line.replace(/^style\s*:/i, ''), styleFormat.length);
			const style = mapAssValues(styleFormat, values);
			styles.push({
				Name: style.Name,
				FontName: style.Fontname || style.FontName,
				FontSize: Number(style.Fontsize || style.FontSize)
			});
			continue;
		}
		if (section.includes('events') && /^dialogue\s*:/i.test(line) && eventFormat.length > 0) {
			const values = splitAssColumns(line.replace(/^dialogue\s*:/i, ''), eventFormat.length);
			const event = mapAssValues(eventFormat, values);
			const startSeconds = parseAssTimeToSeconds(event.Start);
			const endSeconds = parseAssTimeToSeconds(event.End);
			events.push({
				Start: event.Start,
				End: event.End,
				Style: event.Style,
				Text: event.Text,
				startSeconds,
				endSeconds
			});
		}
	}
	return {
		events,
		styles
	};
};

const createJassubTrackDiagnostics = ({
	events,
	styles,
	currentTime
}) => ({
	status: 'ready',
	error: '',
	eventStatus: 'source-ready',
	styleStatus: 'source-ready',
	eventCount: events.length,
	styleCount: styles.length,
	activeEventsAssMs: countActiveAssEvents(events, currentTime),
	activeEventsAssCs: null,
	currentTimeSeconds: Number.isFinite(currentTime) ? Math.round(currentTime * 10) / 10 : 0,
	activeEvent: summarizeAssEvent(findActiveAssEvent(events, currentTime)),
	firstEvent: summarizeAssEvent(events[0]),
	firstStyle: summarizeAssStyle(styles[0])
});

const setJassubTrackDiagnostics = (renderer, diagnostics) => {
	if (!renderer) return;
	renderer.__breezyfinJassubTrackDiagnostics = {
		...(renderer.__breezyfinJassubTrackDiagnostics || {}),
		...diagnostics,
		checkedAtMs: Date.now()
	};
};

export const refreshJassubTrackDiagnostics = async ({
	renderer,
	videoElement,
	subtitleContent = renderer?.__breezyfinJassubSubtitleContent || ''
} = {}) => {
	if (!renderer) return null;
	setJassubTrackDiagnostics(renderer, {
		status: 'loading'
	});
	const {
		events,
		styles
	} = parseAssSourceDiagnostics(subtitleContent);
	renderer.__breezyfinJassubSourceDiagnostics = {events, styles};
	const currentTime = readVideoTime(videoElement);
	const diagnostics = createJassubTrackDiagnostics({events, styles, currentTime});
	setJassubTrackDiagnostics(renderer, diagnostics);
	return diagnostics;
};

const updateJassubTrackDiagnosticsTime = (renderer, videoElement) => {
	const sourceDiagnostics = renderer?.__breezyfinJassubSourceDiagnostics;
	if (!sourceDiagnostics) return renderer?.__breezyfinJassubTrackDiagnostics || null;
	const currentTime = readVideoTime(videoElement);
	const diagnostics = createJassubTrackDiagnostics({
		events: sourceDiagnostics.events || [],
		styles: sourceDiagnostics.styles || [],
		currentTime
	});
	setJassubTrackDiagnostics(renderer, diagnostics);
	return diagnostics;
};

const startJassubTrackDiagnostics = ({
	renderer,
	videoElement,
	subtitleContent
}) => {
	if (renderer) {
		renderer.__breezyfinJassubSubtitleContent = subtitleContent || renderer.__breezyfinJassubSubtitleContent || '';
		renderer.__breezyfinRefreshJassubSourceDiagnostics = (videoElementOverride) => (
			updateJassubTrackDiagnosticsTime(renderer, videoElementOverride || videoElement)
		);
	}
	setJassubTrackDiagnostics(renderer, {
		status: 'pending',
		eventStatus: 'pending',
		styleStatus: 'pending',
		eventCount: 0,
		styleCount: 0,
		activeEventsAssMs: 0,
		activeEventsAssCs: null,
		currentTimeSeconds: Number.isFinite(readVideoTime(videoElement))
			? Math.round(readVideoTime(videoElement) * 10) / 10
			: 0,
		firstEvent: '-',
		firstStyle: '-',
		error: ''
	});
	refreshJassubTrackDiagnostics({renderer, videoElement, subtitleContent}).catch((error) => {
		setJassubTrackDiagnostics(renderer, {
			status: 'error',
			error: error?.message || 'jassub-track-diagnostics-failed'
		});
	});
	return renderer.__breezyfinJassubTrackDiagnostics;
};

const getJassubFontOptions = () => ({
	fonts: [JASSUB_FALLBACK_FONT_URL],
	availableFonts: JASSUB_AVAILABLE_FONTS,
	defaultFont: JASSUB_FALLBACK_FONT_NAME
});

const getJassubRendererOptions = (mode) => ({
	queryFonts: false,
	backend: 'canvas2d',
	fallbackFont: JASSUB_FALLBACK_FONT_NAME,
	preloadedFonts: 1,
	mode,
	prescaleFactor: JASSUB_OPTIONS.prescaleFactor,
	prescaleHeightLimit: JASSUB_OPTIONS.prescaleHeightLimit,
	maxRenderHeight: JASSUB_OPTIONS.maxRenderHeight
});

const buildJassubConstructorOptions = ({
	canvas,
	subtitleContent,
	videoElement
}) => ({
	...(videoElement ? {video: videoElement} : {}),
	...(canvas ? {canvas} : {}),
	subContent: subtitleContent,
	...getJassubFontOptions(),
	queryFonts: false,
	prescaleFactor: JASSUB_OPTIONS.prescaleFactor,
	prescaleHeightLimit: JASSUB_OPTIONS.prescaleHeightLimit,
	maxRenderHeight: JASSUB_OPTIONS.maxRenderHeight,
	debug: false
});

const setJassubRendererOptions = (renderer, mode) => {
	renderer.__breezyfinJassubOptions = getJassubRendererOptions(mode);
};

const buildJassubDebug = ({
	containerElement,
	extra = {},
	mode,
	readyResult,
	renderer,
	videoElement
}) => ({
	mode,
	engine: 'jassub',
	readyStatus: readyResult.status,
	readyWaitMs: readyResult.waitedMs,
	...(readyResult.error ? {readyError: readyResult.error.message || ''} : {}),
	workerUrl: 'bundled',
	wasmUrl: 'bundled',
	modernWasmUrl: 'bundled',
	defaultFont: 'bundled',
	...getJassubRendererOptions(mode),
	...extra,
	...collectExternalRendererDiagnostics({
		containerElement,
		renderer,
		videoElement
	})
});

const forceDisposeJassubRenderer = (renderer, canvas) => {
	try {
		if (typeof renderer?.destroy === 'function') {
			renderer.destroy();
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error destroying timed-out renderer:', error);
	}
	try {
		if (typeof renderer?._worker?.terminate === 'function') {
			renderer._worker.terminate();
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error terminating timed-out renderer worker:', error);
	}
	try {
		if (canvas?.parentNode) {
			canvas.parentNode.removeChild(canvas);
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error removing timed-out renderer canvas:', error);
	}
};

export const waitForJassubReady = (
	readyPromise,
	timeoutMs = JASSUB_READY_TIMEOUT_MS
) => new Promise((resolve) => {
	const startedAt = Date.now();
	let settled = false;
	let timeoutId = null;
	const settle = (result) => {
		if (settled) return;
		settled = true;
		clearTimeout(timeoutId);
		resolve({
			waitedMs: Date.now() - startedAt,
			...result
		});
	};
	timeoutId = setTimeout(() => {
		settle({status: 'timeout'});
	}, timeoutMs);
	readyPromise
		.then(() => settle({status: 'ready'}))
		.catch((error) => settle({
			status: 'error',
			error
		}));
});

export const supportsJassubRenderer = () => supportsJassubRuntime();
export const supportsJassubManualRenderer = () => supportsJassubManualRuntime();

const getManualRenderData = (videoElement, canvas) => {
	const width = Math.max(
		1,
		Math.round(videoElement?.videoWidth || canvas?.clientWidth || canvas?.width || 1)
	);
	const height = Math.max(
		1,
		Math.round(videoElement?.videoHeight || canvas?.clientHeight || canvas?.height || 1)
	);
	return {
		expectedDisplayTime: typeof performance !== 'undefined' && typeof performance.now === 'function'
			? performance.now()
			: Date.now(),
		width,
		height,
		mediaTime: readVideoTime(videoElement)
	};
};

const startManualJassubCanvasSync = ({
	renderer,
	videoElement,
	canvas,
	containerElement,
	onError
}) => {
	if (!renderer || !videoElement || !canvas || !containerElement) return () => {};
	let disposed = false;
	let intervalId = null;
	let renderInFlight = false;
	let runtimeFailed = false;
	let lastSyncedTime = null;
	const failRuntime = (reason, error = null) => {
		if (runtimeFailed || disposed) return;
		runtimeFailed = true;
		renderer.__breezyfinManualRenderStatus = reason;
		renderer.__breezyfinManualRenderError = error?.message || reason;
		renderer.__breezyfinManualRenderFinishedAtMs = Date.now();
		if (intervalId) clearInterval(intervalId);
		if (typeof onError === 'function') {
			onError(error || new Error(reason));
		}
	};
	const syncSize = () => {
		const rect = getManualSubtitleCanvasRect(videoElement, containerElement);
		applyManualSubtitleCanvasStyle(canvas, rect);
	};
	const syncRender = (force = false) => {
		if (disposed || runtimeFailed || typeof renderer.manualRender !== 'function' || renderInFlight) return;
		const shouldForce = force === true;
		const currentTime = readVideoTime(videoElement);
		if (
			!shouldForce &&
			lastSyncedTime !== null &&
			Math.abs(currentTime - lastSyncedTime) < JASSUB_MANUAL_SYNC_MIN_DELTA_SECONDS
		) {
			return;
		}
		syncSize();
		renderInFlight = true;
		renderer.__breezyfinManualRenderStatus = 'pending';
		renderer.__breezyfinManualRenderStartedAtMs = Date.now();
		renderer.__breezyfinManualRenderTimeoutMs = JASSUB_MANUAL_RENDER_TIMEOUT_MS;
		renderer.__breezyfinManualRenderError = '';
		let timeoutId = setTimeout(() => {
			timeoutId = null;
			renderInFlight = false;
			failRuntime('manual-render-timeout');
		}, JASSUB_MANUAL_RENDER_TIMEOUT_MS);
		Promise.resolve(renderer.manualRender(getManualRenderData(videoElement, canvas), shouldForce))
			.then(() => {
				if (runtimeFailed) return;
				lastSyncedTime = currentTime;
				renderer.__breezyfinManualRenderStatus = 'ready';
				renderer.__breezyfinManualRenderFinishedAtMs = Date.now();
				renderer.__breezyfinManualSyncCount = (renderer.__breezyfinManualSyncCount || 0) + 1;
				renderer.__breezyfinManualSyncAtMs = Date.now();
			})
			.catch((error) => {
				if (runtimeFailed) return;
				renderer.__breezyfinManualRenderStatus = 'error';
				renderer.__breezyfinManualRenderError = error?.message || 'manual-render-error';
				renderer.__breezyfinManualRenderFinishedAtMs = Date.now();
				console.warn('[JassubRenderer] Error syncing manual canvas render:', error);
				failRuntime('manual-render-error', error);
			})
			.finally(() => {
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
				renderInFlight = false;
			});
	};
	const onPlaying = () => syncRender(true);
	const onPause = () => syncRender(true);
	const onSeeked = () => syncRender(true);
	const onTimeUpdate = () => syncRender(false);
	const onRateChange = () => syncRender(true);
	const onSizeChange = () => syncRender(true);
	const eventHandlers = [
		['playing', onPlaying],
		['play', onPlaying],
		['pause', onPause],
		['waiting', onPause],
		['seeked', onSeeked],
		['timeupdate', onTimeUpdate],
		['ratechange', onRateChange],
		['loadedmetadata', onSizeChange],
		['resize', onSizeChange]
	];
	eventHandlers.forEach(([eventName, handler]) => {
		videoElement.addEventListener(eventName, handler);
	});
	if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function') {
		renderer.__breezyfinResizeObserver = new window.ResizeObserver(onSizeChange);
		renderer.__breezyfinResizeObserver.observe(containerElement);
		renderer.__breezyfinResizeObserver.observe(videoElement);
	}
	syncRender(true);
	intervalId = setInterval(() => syncRender(false), JASSUB_MANUAL_SYNC_INTERVAL_MS);
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

export const initJassubRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent,
	readyTimeoutMs = JASSUB_READY_TIMEOUT_MS
}) => {
	if (!containerElement) return {instance: null, debug: {engine: 'jassub', status: 'missing-container'}};
	const canvas = document.createElement('canvas');
	canvas.style.position = 'absolute';
	canvas.style.inset = '0';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.pointerEvents = 'none';
	containerElement.appendChild(canvas);
	try {
		const jassubModule = require('jassub');
		const JASSUB = jassubModule.default || jassubModule;
		const renderer = new JASSUB(buildJassubConstructorOptions({
			canvas,
			subtitleContent,
			videoElement
		}));
		setJassubRendererOptions(renderer, 'video-attached');
		const readyResult = renderer.ready && typeof renderer.ready.then === 'function'
			? await waitForJassubReady(renderer.ready, readyTimeoutMs)
			: {status: 'not-exposed', waitedMs: 0};
		if (readyResult.status === 'timeout' || readyResult.status === 'error') {
			forceDisposeJassubRenderer(renderer, canvas);
			return {
				instance: null,
				debug: buildJassubDebug({
					containerElement,
					mode: 'video-attached',
					readyResult,
					renderer,
					videoElement,
					extra: {externalStatus: `ready-${readyResult.status}`}
				})
			};
		}
		renderer.__breezyfinCanvas = canvas;
		startJassubTrackDiagnostics({renderer, videoElement, subtitleContent});
		return {
			instance: renderer,
			debug: buildJassubDebug({
				containerElement,
				mode: 'video-attached',
				readyResult,
				renderer,
				videoElement,
				extra: {
					videoFrameCallback: typeof videoElement?.requestVideoFrameCallback === 'function' ? 'yes' : 'no'
				}
			})
		};
	} catch (error) {
		if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
		throw error;
	}
};

export const initJassubManualRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent,
	onError,
	readyTimeoutMs = JASSUB_READY_TIMEOUT_MS
}) => {
	if (!containerElement) return {instance: null, debug: {engine: 'jassub', status: 'missing-container'}};
	const canvas = document.createElement('canvas');
	canvas.style.position = 'absolute';
	canvas.style.pointerEvents = 'none';
	canvas.style.display = 'block';
	containerElement.appendChild(canvas);
	setManualSubtitleCanvasRect(canvas, videoElement, containerElement);
	try {
		const jassubModule = require('jassub');
		const JASSUB = jassubModule.default || jassubModule;
		const renderer = new JASSUB(buildJassubConstructorOptions({
			canvas,
			subtitleContent
		}));
		setJassubRendererOptions(renderer, 'manual-canvas');
		const readyResult = renderer.ready && typeof renderer.ready.then === 'function'
			? await waitForJassubReady(renderer.ready, readyTimeoutMs)
			: {status: 'not-exposed', waitedMs: 0};
		if (readyResult.status === 'timeout' || readyResult.status === 'error') {
			forceDisposeJassubRenderer(renderer, canvas);
			return {
				instance: null,
				debug: buildJassubDebug({
					containerElement,
					mode: 'manual-canvas',
					readyResult,
					renderer,
					videoElement,
					extra: {externalStatus: `ready-${readyResult.status}`}
				})
			};
		}
		renderer.__breezyfinCanvas = canvas;
		startJassubTrackDiagnostics({renderer, videoElement, subtitleContent});
		renderer.__breezyfinCleanup = startManualJassubCanvasSync({
			renderer,
			videoElement,
			canvas,
			containerElement,
			onError
		});
		return {
			instance: renderer,
			debug: buildJassubDebug({
				containerElement,
				mode: 'manual-canvas',
				readyResult,
				renderer,
				videoElement,
				extra: {
					videoFrameCallback: 'not-used',
					manualSyncIntervalMs: JASSUB_MANUAL_SYNC_INTERVAL_MS,
					manualRenderTimeoutMs: JASSUB_MANUAL_RENDER_TIMEOUT_MS
				}
			})
		};
	} catch (error) {
		if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
		throw error;
	}
};

export const disposeJassubRenderer = (renderer) => {
	if (!renderer) return;
	try {
		if (typeof renderer.__breezyfinCleanup === 'function') {
			renderer.__breezyfinCleanup();
			renderer.__breezyfinCleanup = null;
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error cleaning manual canvas sync:', error);
	}
	try {
		if (typeof renderer.destroy === 'function') {
			renderer.destroy();
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error disposing renderer:', error);
	}
	try {
		if (renderer.__breezyfinCanvas?.parentNode) {
			renderer.__breezyfinCanvas.parentNode.removeChild(renderer.__breezyfinCanvas);
		}
	} catch (error) {
		console.warn('[JassubRenderer] Error removing canvas:', error);
	}
};
