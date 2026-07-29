const roundMetric = (value) => {
	if (!Number.isFinite(value)) return 0;
	return Math.round(value);
};

const formatRect = (element) => {
	if (!element || typeof element.getBoundingClientRect !== 'function') return '-';
	const rect = element.getBoundingClientRect();
	return `${roundMetric(rect.width)}x${roundMetric(rect.height)}@${roundMetric(rect.left)},${roundMetric(rect.top)}`;
};

const getComputedValue = (element, propertyName) => {
	if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return '';
	return window.getComputedStyle(element).getPropertyValue(propertyName) || '';
};

const describeElement = (element) => {
	if (!element) return 'none';
	const tag = String(element.tagName || element.nodeName || 'node').toLowerCase();
	const display = getComputedValue(element, 'display') || '-';
	const visibility = getComputedValue(element, 'visibility') || '-';
	const opacity = getComputedValue(element, 'opacity') || '-';
	const zIndex = getComputedValue(element, 'z-index') || '-';
	return `${tag}:${formatRect(element)}:${display}/${visibility}/op=${opacity}/z=${zIndex}`;
};

const describeCanvasBackingStore = (canvas) => {
	if (!canvas) return '';
	const width = Number(canvas.width || 0);
	const height = Number(canvas.height || 0);
	const clientWidth = Number(canvas.clientWidth || 0);
	const clientHeight = Number(canvas.clientHeight || 0);
	return `${roundMetric(width)}x${roundMetric(height)}/client=${roundMetric(clientWidth)}x${roundMetric(clientHeight)}`;
};

const describeHitTestElement = (element) => {
	if (!element) return 'none';
	const tag = String(element.tagName || element.nodeName || 'node').toLowerCase();
	const id = element.id ? `#${element.id}` : '';
	const className = typeof element.className === 'string'
		? element.className.trim().replace(/\s+/g, '.')
		: '';
	return `${tag}${id}${className ? `.${className}` : ''}`;
};

const getLayerHitTestTarget = (containerElement) => {
	if (!containerElement || typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
		return '';
	}
	if (typeof containerElement.getBoundingClientRect !== 'function') return '';
	const rect = containerElement.getBoundingClientRect();
	if (!(rect.width > 0 && rect.height > 0)) return 'zero-size';
	const x = Math.max(0, Math.min(rect.left + rect.width / 2, (window.innerWidth || rect.right) - 1));
	const y = Math.max(0, Math.min(rect.top + rect.height / 2, (window.innerHeight || rect.bottom) - 1));
	try {
		return describeHitTestElement(document.elementFromPoint(x, y));
	} catch (error) {
		return 'unavailable';
	}
};

const getVideoPhase = (videoElement) => {
	if (!videoElement) return 'no-video';
	if (videoElement.ended) return 'ended';
	if (videoElement.seeking) return 'seeking';
	if (videoElement.paused) return 'paused';
	if (videoElement.readyState < 3) return 'buffering';
	return 'playing';
};

const getVideoDiagnosticSummary = (videoElement) => {
	if (!videoElement) return 'no-video';
	const currentTime = Number.isFinite(videoElement.currentTime)
		? Math.round(videoElement.currentTime * 10) / 10
		: 0;
	return `${getVideoPhase(videoElement)}@${currentTime}s/r${videoElement.readyState || 0}/n${videoElement.networkState || 0}`;
};

const findLibassCanvasParent = (videoElement) => {
	const parent = videoElement?.parentNode;
	if (!parent || typeof parent.querySelector !== 'function') return null;
	return parent.querySelector('.libassjs-canvas-parent');
};

const findLibassCanvas = (videoElement) => {
	const parent = findLibassCanvasParent(videoElement);
	if (!parent || typeof parent.querySelector !== 'function') return null;
	return parent.querySelector('.libassjs-canvas');
};

const findAssJsBox = (containerElement) => {
	if (!containerElement || typeof containerElement.querySelector !== 'function') return null;
	return containerElement.querySelector('.ASS-box');
};

const getNodeCount = (element, selector) => {
	if (!element || typeof element.querySelectorAll !== 'function') return 0;
	return element.querySelectorAll(selector).length;
};

const getRendererNumber = (renderer, propertyName) => {
	const value = renderer?.[propertyName];
	return Number.isFinite(value) ? Math.round(value) : null;
};

const getJassubDemandMediaTime = (renderer) => {
	const mediaTime = renderer?._lastDemandTime?.mediaTime;
	return Number.isFinite(mediaTime) ? Math.round(mediaTime * 10) / 10 : null;
};

const getManualSyncAgeMs = (renderer) => {
	const syncedAt = renderer?.__breezyfinManualSyncAtMs;
	if (!Number.isFinite(syncedAt)) return null;
	return Math.max(0, Date.now() - syncedAt);
};

const getManualRenderAgeMs = (renderer) => {
	const startedAt = renderer?.__breezyfinManualRenderStartedAtMs;
	const finishedAt = renderer?.__breezyfinManualRenderFinishedAtMs;
	if (!Number.isFinite(startedAt)) return null;
	if (Number.isFinite(finishedAt) && finishedAt >= startedAt) {
		return Math.max(0, finishedAt - startedAt);
	}
	return Math.max(0, Date.now() - startedAt);
};

const getJassubTrackDiagnosticAgeMs = (renderer) => {
	const checkedAt = renderer?.__breezyfinJassubTrackDiagnostics?.checkedAtMs;
	if (!Number.isFinite(checkedAt)) return null;
	return Math.max(0, Date.now() - checkedAt);
};

const getJassubOptionLabel = (renderer) => {
	const options = renderer?.__breezyfinJassubOptions;
	if (!options) return '';
	return [
		options.mode ? `mode=${options.mode}` : '',
		options.backend ? `backend=${options.backend}` : '',
		options.queryFonts === false ? 'queryFonts=no' : '',
		options.fallbackFont ? `font=${options.fallbackFont}` : '',
		Number.isFinite(options.preloadedFonts) ? `fonts=${options.preloadedFonts}` : '',
		Number.isFinite(options.prescaleFactor) ? `scale=${options.prescaleFactor}` : '',
		Number.isFinite(options.prescaleHeightLimit) ? `scaleH=${options.prescaleHeightLimit}` : '',
		Number.isFinite(options.maxRenderHeight) ? `maxH=${options.maxRenderHeight}` : ''
	].filter(Boolean).join('/');
};

export const getCanvasPixelDiagnostics = (canvas) => {
	if (!canvas) {
		return {
			canvasPixels: 'no-canvas',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		};
	}
	const sourceWidth = Number(canvas.width || canvas.clientWidth || 0);
	const sourceHeight = Number(canvas.height || canvas.clientHeight || 0);
	if (!(sourceWidth > 0 && sourceHeight > 0)) {
		return {
			canvasPixels: 'zero-size',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		};
	}
	if (typeof document === 'undefined') {
		return {
			canvasPixels: 'unavailable',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		};
	}
	try {
		const probeCanvas = document.createElement('canvas');
		probeCanvas.width = 16;
		probeCanvas.height = 9;
		const context = probeCanvas.getContext?.('2d', {willReadFrequently: true});
		if (!context) {
			return {
				canvasPixels: 'unreadable',
				canvasAlphaSamples: 0,
				canvasMaxAlpha: 0
			};
		}
		context.clearRect(0, 0, probeCanvas.width, probeCanvas.height);
		context.drawImage(canvas, 0, 0, probeCanvas.width, probeCanvas.height);
		const data = context.getImageData(0, 0, probeCanvas.width, probeCanvas.height).data;
		let alphaSamples = 0;
		let maxAlpha = 0;
		for (let index = 3; index < data.length; index += 4) {
			const alpha = data[index] || 0;
			if (alpha > 8) alphaSamples += 1;
			if (alpha > maxAlpha) maxAlpha = alpha;
		}
		return {
			canvasPixels: alphaSamples > 0 ? 'drawn' : 'empty',
			canvasAlphaSamples: alphaSamples,
			canvasMaxAlpha: maxAlpha
		};
	} catch (error) {
		return {
			canvasPixels: 'unreadable',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		};
	}
};

export const isExternalRendererEmptyOutputFailure = (diagnostics) => (
	diagnostics?.canvasPixels === 'empty' &&
	Number(diagnostics?.jassubActiveEventsAssMs || 0) > 0
);

export const probeExternalRendererOutput = ({renderer = null, videoElement = null} = {}) => {
	try {
		if (typeof renderer?.__breezyfinRefreshJassubSourceDiagnostics === 'function') {
			renderer.__breezyfinRefreshJassubSourceDiagnostics(videoElement);
		}
	} catch (error) {
		// The bounded correctness probe must not destabilize playback.
	}
	const canvas = renderer?.__breezyfinCanvas || findLibassCanvas(videoElement);
	const trackDiagnostics = renderer?.__breezyfinJassubTrackDiagnostics || {};
	return {
		jassubActiveEventsAssMs: Number.isFinite(trackDiagnostics.activeEventsAssMs)
			? trackDiagnostics.activeEventsAssMs
			: null,
		...getCanvasPixelDiagnostics(canvas)
	};
};

export const collectExternalRendererDiagnostics = ({
	containerElement,
	renderer = null,
	videoElement = null
} = {}) => {
	try {
		if (typeof renderer?.__breezyfinRefreshJassubSourceDiagnostics === 'function') {
			renderer.__breezyfinRefreshJassubSourceDiagnostics(videoElement);
		}
	} catch (error) {
		// Diagnostics must not destabilize playback.
	}
	const canvas = renderer?.__breezyfinCanvas || findLibassCanvas(videoElement);
	const canvasParent = canvas?.parentNode || findLibassCanvasParent(videoElement);
	const assBox = findAssJsBox(containerElement);
	const pixelDiagnostics = getCanvasPixelDiagnostics(canvas);
	const jassubTrackDiagnostics = renderer?.__breezyfinJassubTrackDiagnostics || {};
	let bitmapDiagnostics = {};
	try {
		bitmapDiagnostics = typeof renderer?.__breezyfinGetDiagnostics === 'function'
			? renderer.__breezyfinGetDiagnostics()
			: (renderer?.__breezyfinBitmapDiagnostics || {});
	} catch (error) {
		bitmapDiagnostics = {
			bitmapDiagnosticError: 'diagnostic-error'
		};
	}
	return {
		layerChildren: containerElement?.childNodes?.length ?? 0,
		layerBox: describeElement(containerElement),
		layerHitTest: getLayerHitTestTarget(containerElement),
		videoPhase: getVideoPhase(videoElement),
		videoState: getVideoDiagnosticSummary(videoElement),
		canvasBox: describeElement(canvas),
		canvasBackingStore: describeCanvasBackingStore(canvas),
		canvasParentBox: describeElement(canvasParent),
		assBox: describeElement(assBox),
		assDialogueCount: getNodeCount(assBox, '.ASS-dialogue'),
		rendererLastRenderTime: getRendererNumber(renderer, 'lastRenderTime'),
		rendererFrameId: getRendererNumber(renderer, 'frameId'),
		rendererDemandMediaTime: getJassubDemandMediaTime(renderer),
		rendererBusy: renderer?.busy === true ? 'yes' : (renderer?.busy === false ? 'no' : ''),
		rendererManualSyncCount: getRendererNumber(renderer, '__breezyfinManualSyncCount'),
		rendererManualSyncAgeMs: getManualSyncAgeMs(renderer),
		manualRenderStatus: renderer?.__breezyfinManualRenderStatus || '',
		manualRenderAgeMs: getManualRenderAgeMs(renderer),
		manualRenderTimeoutMs: getRendererNumber(renderer, '__breezyfinManualRenderTimeoutMs'),
		manualRenderError: renderer?.__breezyfinManualRenderError || '',
		jassubTrackStatus: jassubTrackDiagnostics.status || '',
		jassubEventStatus: jassubTrackDiagnostics.eventStatus || '',
		jassubStyleStatus: jassubTrackDiagnostics.styleStatus || '',
		jassubEventCount: Number.isFinite(jassubTrackDiagnostics.eventCount) ? jassubTrackDiagnostics.eventCount : null,
		jassubStyleCount: Number.isFinite(jassubTrackDiagnostics.styleCount) ? jassubTrackDiagnostics.styleCount : null,
		jassubActiveEventsAssMs: Number.isFinite(jassubTrackDiagnostics.activeEventsAssMs)
			? jassubTrackDiagnostics.activeEventsAssMs
			: null,
		jassubActiveEventsAssCs: Number.isFinite(jassubTrackDiagnostics.activeEventsAssCs)
			? jassubTrackDiagnostics.activeEventsAssCs
			: null,
		jassubCurrentTimeSeconds: Number.isFinite(jassubTrackDiagnostics.currentTimeSeconds)
			? jassubTrackDiagnostics.currentTimeSeconds
			: null,
		jassubActiveEvent: jassubTrackDiagnostics.activeEvent || '',
		jassubFirstEvent: jassubTrackDiagnostics.firstEvent || '',
		jassubFirstStyle: jassubTrackDiagnostics.firstStyle || '',
		jassubTrackDiagnosticAgeMs: getJassubTrackDiagnosticAgeMs(renderer),
		jassubTrackError: jassubTrackDiagnostics.error || '',
		jassubOptions: getJassubOptionLabel(renderer),
		...bitmapDiagnostics,
		...pixelDiagnostics,
		diagnosticAtMs: Date.now()
	};
};
