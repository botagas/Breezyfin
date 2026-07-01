import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {getSubtitleTranscodePolicy} from '../../../services/jellyfin/playbackSelection';
import {toInteger} from '../../../utils/numberParsing';
import {
	findActiveSubtitleCues,
	normalizeSubtitleEvents,
	normalizeSubtitleText
} from '../utils/subtitleRenderer';
import {
	getSubtitleBurnInFallbackStatus,
	normalizeSubtitleRendererFailureReason
} from '../utils/subtitleRendererStatus';
import {
	disposeExternalAssRenderer,
	initExternalAssRenderer,
	isExternalAssRendererId,
	SUBTITLE_RENDERER_IDS,
	supportsExternalAssRenderer
} from '../utils/subtitle-renderers/subtitleRendererRegistry';
import {
	collectExternalRendererDiagnostics,
	isExternalRendererEmptyOutputFailure
} from '../utils/subtitle-renderers/rendererDiagnostics';
import {waitForAttachedVideoSource} from '../utils/subtitle-renderers/videoSourceReady';

const SUBTITLE_EVENT_CACHE_LIMIT = 8;
const EXTERNAL_RENDERER_DIAGNOSTIC_REFRESH_MS = 1500;
const EXTERNAL_RENDERER_EMPTY_OUTPUT_CHECK_MS = 1000;
const EXTERNAL_RENDERER_EMPTY_OUTPUT_SAMPLE_LIMIT = 3;
const subtitleEventCache = new Map();
const TEXT_SUBTITLE_RAW_FORMATS_BY_CODEC = {
	srt: ['vtt', 'srt'],
	subrip: ['vtt', 'srt'],
	vtt: ['vtt'],
	webvtt: ['vtt'],
	ass: ['ass', 'ssa'],
	ssa: ['ssa', 'ass'],
	advancedsubstationalpha: ['ass', 'ssa'],
	substationalpha: ['ssa', 'ass']
};

const getRawSubtitleFormats = (codec) => (
	TEXT_SUBTITLE_RAW_FORMATS_BY_CODEC[String(codec || '').trim().toLowerCase()] || ['vtt', 'srt']
);

const getSubtitleTrack = (tracks, trackIndex) => {
	const index = toInteger(trackIndex);
	if (index === null || index < 0) return null;
	return (tracks || []).find((track) => toInteger(track?.Index) === index) || null;
};

const isJassubRendererMode = (rendererMode) => (
	rendererMode === SUBTITLE_RENDERER_IDS.ASS_JASSUB ||
	rendererMode === SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL
);

const readSubtitleEventCache = (key) => {
	if (!key || !subtitleEventCache.has(key)) return null;
	const value = subtitleEventCache.get(key);
	subtitleEventCache.delete(key);
	subtitleEventCache.set(key, value);
	return value;
};

const writeSubtitleEventCache = (key, value) => {
	if (!key) return;
	subtitleEventCache.set(key, value);
	while (subtitleEventCache.size > SUBTITLE_EVENT_CACHE_LIMIT) {
		const firstKey = subtitleEventCache.keys().next().value;
		subtitleEventCache.delete(firstKey);
	}
};

export const usePlayerSubtitleRenderer = ({
	item,
	videoRef,
	externalSubtitleLayerRef,
	mediaSourceData,
	subtitleTracks,
	currentSubtitleTrack,
	currentTime,
	playbackSettingsRef,
	onBurnInFallback,
	setToastMessage
}) => {
	const requestIdRef = useRef(0);
	const fallbackAttemptedKeysRef = useRef(new Set());
	const onBurnInFallbackRef = useRef(onBurnInFallback);
	const setToastMessageRef = useRef(setToastMessage);
	const [events, setEvents] = useState([]);
	const [state, setState] = useState({
		renderer: 'off',
		status: 'off',
		error: '',
		fallbackReason: '',
		eventCount: 0,
		cueCount: 0,
		activeCueCount: 0,
		debug: null
	});

	const selectedSubtitleTrack = useMemo(
		() => getSubtitleTrack(subtitleTracks, currentSubtitleTrack),
		[currentSubtitleTrack, subtitleTracks]
	);
	const subtitlePolicy = useMemo(() => {
		if (!(Number.isInteger(currentSubtitleTrack) && currentSubtitleTrack >= 0)) {
			return mediaSourceData?.__debugSubtitlePolicy || null;
		}
		const settings = playbackSettingsRef?.current || {};
		return getSubtitleTranscodePolicy(mediaSourceData, currentSubtitleTrack, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
			assSubtitleRenderer: settings.assSubtitleRenderer,
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs
		});
	}, [currentSubtitleTrack, mediaSourceData, playbackSettingsRef]);
	const shouldUseClientRenderer =
		Number.isInteger(currentSubtitleTrack) &&
		currentSubtitleTrack >= 0 &&
		String(subtitlePolicy?.renderer || '').startsWith('client') &&
		subtitlePolicy?.clientRender === true;
	const subtitleKey = shouldUseClientRenderer
		? `${item?.Id || ''}:${mediaSourceData?.Id || ''}:${currentSubtitleTrack}`
		: '';
	const externalRendererRef = useRef({
		rendererId: '',
		instance: null
	});

	useEffect(() => {
		onBurnInFallbackRef.current = onBurnInFallback;
		setToastMessageRef.current = setToastMessage;
	}, [onBurnInFallback, setToastMessage]);

	const disposeCurrentExternalRenderer = useCallback(() => {
		if (externalRendererRef.current.instance) {
			disposeExternalAssRenderer(
				externalRendererRef.current.rendererId,
				externalRendererRef.current.instance,
				{containerElement: externalSubtitleLayerRef?.current}
			);
		}
		externalRendererRef.current = {
			rendererId: '',
			instance: null
		};
	}, [externalSubtitleLayerRef]);

	useEffect(() => {
		fallbackAttemptedKeysRef.current = new Set();
	}, [item?.Id, mediaSourceData?.Id]);

	const fallbackToBurnIn = useCallback((reason) => {
		const fallbackAllowed = subtitlePolicy?.fallbackBurnInAllowed === true;
		const fallbackAlreadyStarted = !subtitleKey || fallbackAttemptedKeysRef.current.has(subtitleKey);
		if (!subtitleKey || fallbackAttemptedKeysRef.current.has(subtitleKey)) {
			return getSubtitleBurnInFallbackStatus({
				fallbackAllowed,
				fallbackAlreadyStarted
			});
		}
		if (!fallbackAllowed) {
			setToastMessageRef.current?.('Subtitle renderer failed. Preserving HDR/DV without subtitle burn-in.');
			return getSubtitleBurnInFallbackStatus({fallbackAllowed});
		}
		fallbackAttemptedKeysRef.current.add(subtitleKey);
		setToastMessageRef.current?.('Subtitle renderer failed. Retrying with subtitle burn-in...');
		if (typeof onBurnInFallbackRef.current !== 'function') {
			return getSubtitleBurnInFallbackStatus({
				fallbackAllowed,
				hasFallbackHandler: false
			});
		}
		onBurnInFallbackRef.current({
			subtitleStreamIndex: currentSubtitleTrack,
			reason
		});
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler: true
		});
	}, [currentSubtitleTrack, subtitleKey, subtitlePolicy?.fallbackBurnInAllowed]);

	useEffect(() => {
		requestIdRef.current += 1;
		const requestId = requestIdRef.current;
		if (!shouldUseClientRenderer) {
			disposeCurrentExternalRenderer();
			setEvents([]);
			setState({
				renderer: currentSubtitleTrack === -1
					? 'off'
					: (subtitlePolicy?.renderer || 'native'),
				status: currentSubtitleTrack === -1 ? 'off' : (subtitlePolicy?.renderer || 'native'),
				error: '',
				fallbackReason: '',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: null
			});
			return undefined;
		}
		if (!item?.Id || !mediaSourceData?.Id || !selectedSubtitleTrack) {
			disposeCurrentExternalRenderer();
			const fallbackStatus = fallbackToBurnIn('missing-subtitle-context');
			setEvents([]);
			setState({
				renderer: subtitlePolicy?.renderer || 'client',
				status: fallbackStatus,
				error: 'missing-subtitle-context',
				fallbackReason: 'missing-subtitle-context',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: {cacheKey: subtitleKey || '', cacheHit: false}
			});
			return undefined;
		}

		const rendererMode = subtitlePolicy?.renderer || 'client';
		const domRendererName = rendererMode === 'client-ass-lightweight' ? 'client-ass-lightweight' : 'client-text';
		if (isExternalAssRendererId(rendererMode)) {
			disposeCurrentExternalRenderer();
			const assFormat = getRawSubtitleFormats(subtitlePolicy?.codec)[0] || 'ass';
			const buildExternalDebug = (extra = {}) => ({
				cacheKey: subtitleKey,
				cacheHit: false,
				path: extra.path || '',
				rawFormat: assFormat,
				rawShape: extra.rawShape || 'ass-content',
				requestedRenderer: rendererMode,
				...extra
			});
			const videoElement = videoRef.current;
			const containerElement = externalSubtitleLayerRef?.current;
			let externalCancelled = false;
			let externalDebug = buildExternalDebug({
				externalStatus: 'loading'
			});
			const assStartedAt = Date.now();
			let emptyOutputSampleCount = 0;
			let emptyOutputWatchdogId = null;
			const clearEmptyOutputWatchdog = () => {
				if (!emptyOutputWatchdogId) return;
				clearInterval(emptyOutputWatchdogId);
				emptyOutputWatchdogId = null;
			};
			const updateExternalDebug = (debug) => {
				setState((current) => {
					if (current.renderer !== rendererMode || current.status !== 'loading') return current;
					return {
						...current,
						debug: {
							...(current.debug || {}),
							...debug
						}
					};
				});
			};
			const applyLightweightFallbackFromText = (textResult, reason, debug = externalDebug) => {
				const normalizedEvents = textResult?.ok === true && textResult.text
					? normalizeSubtitleText(textResult.text, textResult.format || assFormat)
					: [];
				if (normalizedEvents.length === 0) {
					const fallbackStatus = fallbackToBurnIn(reason);
					setEvents([]);
					setState({
						renderer: rendererMode,
						status: fallbackStatus,
						error: reason,
						fallbackReason: reason,
						eventCount: 0,
						cueCount: 0,
						activeCueCount: 0,
						debug: {
							...debug,
							externalStatus: 'fallback-failed',
							fallbackRenderer: 'client-ass-lightweight'
						}
					});
					return;
				}
				writeSubtitleEventCache(subtitleKey, {
					events: normalizedEvents,
					debug: {
						...debug,
						externalStatus: 'fallback-ready',
						fallbackRenderer: 'client-ass-lightweight'
					}
				});
				setEvents(normalizedEvents);
				setState({
					renderer: 'client-ass-lightweight',
					status: 'ready',
					error: '',
					fallbackReason: reason,
					eventCount: normalizedEvents.length,
					cueCount: normalizedEvents.length,
					activeCueCount: 0,
					debug: {
						...debug,
						externalStatus: 'fallback-ready',
						fallbackRenderer: 'client-ass-lightweight'
					}
				});
			};
			const startEmptyOutputWatchdog = (textResult, rendererResult) => {
				if (!isJassubRendererMode(rendererMode) || !rendererResult?.instance) return;
				clearEmptyOutputWatchdog();
				emptyOutputWatchdogId = setInterval(() => {
					if (externalCancelled || requestId !== requestIdRef.current) {
						clearEmptyOutputWatchdog();
						return;
					}
					const currentRenderer = externalRendererRef.current;
					if (currentRenderer.rendererId !== rendererMode || currentRenderer.instance !== rendererResult.instance) {
						clearEmptyOutputWatchdog();
						return;
					}
					const diagnostics = collectExternalRendererDiagnostics({
						containerElement,
						renderer: rendererResult.instance,
						videoElement
					});
					if (!isExternalRendererEmptyOutputFailure(diagnostics)) {
						emptyOutputSampleCount = 0;
						if (diagnostics.canvasPixels === 'drawn') clearEmptyOutputWatchdog();
						return;
					}
					emptyOutputSampleCount += 1;
					if (emptyOutputSampleCount < EXTERNAL_RENDERER_EMPTY_OUTPUT_SAMPLE_LIMIT) return;
					clearEmptyOutputWatchdog();
					disposeCurrentExternalRenderer();
					applyLightweightFallbackFromText(textResult, 'external-renderer-empty-output', {
						...externalDebug,
						...(rendererResult.debug || {}),
						...diagnostics,
						externalStatus: 'empty-output-fallback',
						fetchMs: Date.now() - assStartedAt
					});
				}, EXTERNAL_RENDERER_EMPTY_OUTPUT_CHECK_MS);
			};
			setEvents([]);
			setState({
				renderer: rendererMode,
				status: 'loading',
				error: '',
				fallbackReason: '',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: externalDebug
			});
			(async () => {
				const textResult = await jellyfinService.getSubtitleText(
					item.Id,
					mediaSourceData.Id,
					currentSubtitleTrack,
					assFormat
				);
				if (externalCancelled || requestId !== requestIdRef.current) return;
				externalDebug = buildExternalDebug({
					path: textResult?.path || '',
					rawShape: textResult?.rawShape || 'text',
					rawFormat: textResult?.format || assFormat,
					rawContentType: textResult?.contentType || '',
					externalStatus: 'subtitle-loaded',
					fetchMs: Date.now() - assStartedAt
				});
				if (textResult?.ok !== true || !textResult.text) {
					const reason = normalizeSubtitleRendererFailureReason(textResult?.error, 'raw-fetch-failed');
					applyLightweightFallbackFromText(textResult, reason, {
						...externalDebug,
						externalStatus: 'subtitle-fetch-failed'
					});
					return;
				}
				if (!videoElement || !containerElement) {
					applyLightweightFallbackFromText(textResult, 'missing-external-renderer-context', {
						...externalDebug,
						externalStatus: 'missing-context'
					});
					return;
				}
				updateExternalDebug({
					...externalDebug,
					externalStatus: 'waiting-video-source',
					videoReadyState: Number(videoElement.readyState) || 0,
					videoNetworkState: Number(videoElement.networkState) || 0,
					videoHasCurrentSrc: Boolean(videoElement.currentSrc),
					videoHasSrc: Boolean(videoElement.src || videoElement.getAttribute?.('src')),
					videoHasSrcObject: Boolean(videoElement.srcObject)
				});
				const videoSourceWait = await waitForAttachedVideoSource(videoElement, {
					isCancelled: () => externalCancelled || requestId !== requestIdRef.current
				});
				if (externalCancelled || requestId !== requestIdRef.current) return;
				externalDebug = {
					...externalDebug,
					videoSourceStatus: videoSourceWait.status,
					videoSourceWaitMs: videoSourceWait.waitedMs,
					videoReadyState: Number(videoElement.readyState) || 0,
					videoNetworkState: Number(videoElement.networkState) || 0,
					videoHasCurrentSrc: Boolean(videoElement.currentSrc),
					videoHasSrc: Boolean(videoElement.src || videoElement.getAttribute?.('src')),
					videoHasSrcObject: Boolean(videoElement.srcObject)
				};
				if (videoSourceWait.status !== 'ready') {
					applyLightweightFallbackFromText(textResult, 'external-renderer-video-source-not-ready', {
						...externalDebug,
						externalStatus: 'video-source-not-ready'
					});
					return;
				}
				if (!supportsExternalAssRenderer(rendererMode)) {
					applyLightweightFallbackFromText(textResult, 'external-renderer-unavailable', {
						...externalDebug,
						externalStatus: 'unavailable'
					});
					return;
				}
				updateExternalDebug({
					...externalDebug,
					externalStatus: 'initializing-renderer'
				});
				const rendererResult = await initExternalAssRenderer(rendererMode, {
					videoElement,
					containerElement,
					subtitleContent: textResult.text,
					onError: () => {
						if (externalCancelled || requestId !== requestIdRef.current) return;
						disposeCurrentExternalRenderer();
						applyLightweightFallbackFromText(textResult, 'external-renderer-runtime-error', {
							...externalDebug,
							externalStatus: 'runtime-error',
							fetchMs: Date.now() - assStartedAt
						});
					}
				});
				if (externalCancelled || requestId !== requestIdRef.current) {
					disposeExternalAssRenderer(rendererMode, rendererResult?.instance, {containerElement});
					return;
				}
				if (!rendererResult?.instance) {
					applyLightweightFallbackFromText(textResult, 'external-renderer-init-failed', {
						...externalDebug,
						...(rendererResult?.debug || {}),
						externalStatus: 'init-failed',
						fetchMs: Date.now() - assStartedAt
					});
					return;
				}
				externalRendererRef.current = {
					rendererId: rendererMode,
					instance: rendererResult.instance
				};
				startEmptyOutputWatchdog(textResult, rendererResult);
				setState({
					renderer: rendererMode,
					status: 'ready',
					error: '',
					fallbackReason: '',
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: {
						...externalDebug,
						...(rendererResult.debug || {}),
						externalStatus: 'ready',
						fetchMs: Date.now() - assStartedAt
					}
				});
			})().catch((error) => {
				if (externalCancelled || requestId !== requestIdRef.current) return;
				const reason = normalizeSubtitleRendererFailureReason(error?.message, 'external-renderer-init-failed');
				applyLightweightFallbackFromText(null, reason, {
					...externalDebug,
					externalStatus: 'init-error',
					fetchMs: Date.now() - assStartedAt
				});
			});
			return () => {
				externalCancelled = true;
				clearEmptyOutputWatchdog();
				disposeCurrentExternalRenderer();
			};
		}

		disposeCurrentExternalRenderer();
		const cachedEvents = readSubtitleEventCache(subtitleKey);
		if (cachedEvents) {
			setEvents(cachedEvents.events);
			setState({
				renderer: domRendererName,
				status: 'ready',
				error: '',
				fallbackReason: '',
				eventCount: cachedEvents.events.length,
				cueCount: cachedEvents.events.length,
				activeCueCount: 0,
				debug: {
					...cachedEvents.debug,
					cacheHit: true,
					cacheKey: subtitleKey
				}
			});
			return undefined;
		}

		let cancelled = false;
		setEvents([]);
		setState({
			renderer: domRendererName,
			status: 'loading',
			error: '',
			fallbackReason: '',
			eventCount: 0,
			cueCount: 0,
			activeCueCount: 0,
			debug: {
				cacheKey: subtitleKey,
				cacheHit: false
			}
		});

		const fetchStartedAt = Date.now();
		(async () => {
			const result = await jellyfinService.getSubtitleEvents(item.Id, mediaSourceData.Id, currentSubtitleTrack);
			if (cancelled || requestId !== requestIdRef.current) return;
			const eventFetchMs = Date.now() - fetchStartedAt;
			const eventDebug = {
				cacheKey: subtitleKey,
				cacheHit: false,
				path: result?.path || '',
				rawShape: result?.rawShape || 'unknown',
				fetchMs: eventFetchMs
			};
			let normalizedEvents = [];
			let fallbackReason = '';
			if (result?.ok === true) {
				normalizedEvents = normalizeSubtitleEvents(result.events);
				if (normalizedEvents.length === 0) {
					fallbackReason = 'empty-events';
				}
			} else {
				fallbackReason = normalizeSubtitleRendererFailureReason(result?.error);
			}

			let debug = eventDebug;
			if (normalizedEvents.length === 0) {
				const rawFormats = getRawSubtitleFormats(subtitlePolicy?.codec);
				for (const rawFormat of rawFormats) {
					const rawResult = await jellyfinService.getSubtitleText(
						item.Id,
						mediaSourceData.Id,
						currentSubtitleTrack,
						rawFormat
					);
					if (cancelled || requestId !== requestIdRef.current) return;
					debug = {
						...eventDebug,
						rawPath: rawResult?.path || '',
						rawUrl: rawResult?.url || '',
						rawShape: rawResult?.rawShape || 'text',
						rawFormat,
						rawTried: rawFormats.join(','),
						rawContentType: rawResult?.contentType || '',
						fetchMs: Date.now() - fetchStartedAt
					};
					if (rawResult?.ok === true) {
						normalizedEvents = normalizeSubtitleText(rawResult.text, rawFormat);
						if (normalizedEvents.length > 0) {
							fallbackReason = '';
							break;
						}
						fallbackReason = 'empty-raw-subtitle-text';
					} else {
						fallbackReason = normalizeSubtitleRendererFailureReason(rawResult?.error, 'raw-fetch-failed');
					}
				}
			}

			if (normalizedEvents.length === 0) {
				const fallbackStatus = fallbackToBurnIn(fallbackReason || 'empty-events');
				setEvents([]);
				setState({
					renderer: domRendererName,
					status: fallbackStatus,
					error: fallbackReason || 'empty-events',
					fallbackReason: fallbackReason || 'empty-events',
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug
				});
				return;
			}
			writeSubtitleEventCache(subtitleKey, {
				events: normalizedEvents,
				debug
			});
			setEvents(normalizedEvents);
			setState({
				renderer: domRendererName,
				status: 'ready',
				error: '',
				fallbackReason: '',
				eventCount: normalizedEvents.length,
				cueCount: normalizedEvents.length,
				activeCueCount: 0,
				debug
			});
		})().catch((error) => {
				if (cancelled || requestId !== requestIdRef.current) return;
				const reason = normalizeSubtitleRendererFailureReason(error?.message, 'fetch-failed');
				const fallbackStatus = fallbackToBurnIn(reason);
				setEvents([]);
				setState({
					renderer: domRendererName,
					status: fallbackStatus,
					error: 'fetch-failed',
					fallbackReason: reason,
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: {
						cacheKey: subtitleKey,
						cacheHit: false,
						fetchMs: Date.now() - fetchStartedAt
					}
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		currentSubtitleTrack,
		disposeCurrentExternalRenderer,
		externalSubtitleLayerRef,
		fallbackToBurnIn,
		item?.Id,
		mediaSourceData?.Id,
		selectedSubtitleTrack,
		shouldUseClientRenderer,
		subtitleKey,
		subtitlePolicy?.codec,
		subtitlePolicy?.renderer,
		videoRef
	]);

	useEffect(() => {
		if (!isExternalAssRendererId(state.renderer) || state.status !== 'ready') return undefined;
		const rendererId = state.renderer;
		const updateDiagnostics = () => {
			const currentRenderer = externalRendererRef.current;
			if (currentRenderer.rendererId !== rendererId || !currentRenderer.instance) return;
			const layerDiagnostics = collectExternalRendererDiagnostics({
				containerElement: externalSubtitleLayerRef?.current,
				renderer: currentRenderer.instance,
				videoElement: videoRef.current
			});
			setState((current) => {
				if (current.renderer !== rendererId || current.status !== 'ready') return current;
				return {
					...current,
					debug: {
						...(current.debug || {}),
						...layerDiagnostics,
						diagnosticRefreshMs: EXTERNAL_RENDERER_DIAGNOSTIC_REFRESH_MS
					}
				};
			});
		};
		updateDiagnostics();
		const intervalId = setInterval(updateDiagnostics, EXTERNAL_RENDERER_DIAGNOSTIC_REFRESH_MS);
		return () => clearInterval(intervalId);
	}, [externalSubtitleLayerRef, state.renderer, state.status, videoRef]);

	const activeSubtitle = useMemo(() => {
		if (!shouldUseClientRenderer || state.status !== 'ready') {
			return {
				cues: [],
				text: '',
				activeCount: 0
			};
		}
		const active = findActiveSubtitleCues(events, currentTime);
		return {
			...active,
			text: active.cues.map((cue) => cue.lines.join('\n')).join('\n')
		};
	}, [currentTime, events, shouldUseClientRenderer, state.status]);

	useEffect(() => {
		setState((current) => {
			if (current.activeCueCount === activeSubtitle.activeCount) return current;
			return {
				...current,
				activeCueCount: activeSubtitle.activeCount
			};
		});
	}, [activeSubtitle.activeCount]);

	return {
		subtitleText: activeSubtitle.text,
		subtitleCues: activeSubtitle.cues,
		subtitleRendererPolicy: subtitlePolicy,
		subtitleRendererState: state
	};
};
