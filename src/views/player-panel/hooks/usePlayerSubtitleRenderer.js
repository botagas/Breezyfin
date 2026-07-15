import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {useRuntimeSuspended} from '../../../hooks/useRuntimeSuspension';
import {getSubtitleTranscodePolicy} from '../../../utils/playbackSelection';
import {toInteger} from '../../../utils/numberParsing';
import {
	findActiveSubtitleCues,
	normalizeSubtitleEvents,
	normalizeSubtitleText
} from '../utils/subtitleRenderer';
import {normalizeSubtitleRendererFailureReason} from '../utils/subtitleRendererStatus';
import {runSubtitleBurnInFallbackDecision} from '../utils/subtitleBurnInFallbackDecision';
import {
	disposeExternalAssRenderer,
	disposeExternalBitmapRenderer,
	initExternalAssRenderer,
	initExternalBitmapRenderer,
	isExternalAssRendererId,
	isExternalBitmapRendererId,
	SUBTITLE_RENDERER_IDS,
	supportsExternalAssRenderer,
	supportsExternalBitmapRenderer
} from '../utils/subtitle-renderers/subtitleRendererRegistry';
import {
	collectExternalRendererDiagnostics,
	isExternalRendererEmptyOutputFailure,
	probeExternalRendererOutput
} from '../utils/subtitle-renderers/rendererDiagnostics';
import {waitForAttachedVideoSource} from '../utils/subtitle-renderers/videoSourceReady';
import {
	BITMAP_SUBTITLE_RAW_FORMATS,
	buildBitmapDeliveryFetchDebug,
	getBitmapRendererSequence
} from '../utils/bitmapSubtitleDeliveryDebug';
import {getRawSubtitleFormats} from '../utils/subtitleRawFormats';

const SUBTITLE_EVENT_CACHE_LIMIT = 8;
const EXTERNAL_RENDERER_DIAGNOSTIC_REFRESH_MS = 1500;
const EXTERNAL_RENDERER_EMPTY_OUTPUT_CHECK_MS = 1000;
const EXTERNAL_RENDERER_EMPTY_OUTPUT_SAMPLE_LIMIT = 3;
const subtitleEventCache = new Map();
const getSubtitleTrack = (tracks, trackIndex) => {
	const index = toInteger(trackIndex);
	if (index === null || index < 0) return null;
	return (tracks || []).find((track) => toInteger(track?.Index) === index) || null;
};

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
	setToastMessage,
	playbackGeneration,
	exitInProgressRef,
	diagnosticsEnabled = false,
	debugDiagnosticsEnabled = false
}) => {
	const runtimeSuspended = useRuntimeSuspended();
	const requestIdRef = useRef(0);
	const fallbackAttemptedKeysRef = useRef(new Set());
	const onBurnInFallbackRef = useRef(onBurnInFallback);
	const setToastMessageRef = useRef(setToastMessage);
	const diagnosticsEnabledRef = useRef(diagnosticsEnabled);
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
	useEffect(() => {
		diagnosticsEnabledRef.current = diagnosticsEnabled;
	}, [diagnosticsEnabled]);

	const sourceIsCurrent = Boolean(
		item?.Id &&
		mediaSourceData?.Id &&
		mediaSourceData?.__itemId === item.Id &&
		mediaSourceData?.__playbackGeneration === playbackGeneration
	);
	const selectedSubtitleTrack = useMemo(
		() => sourceIsCurrent ? getSubtitleTrack(subtitleTracks, currentSubtitleTrack) : null,
		[currentSubtitleTrack, sourceIsCurrent, subtitleTracks]
	);
	const subtitlePolicy = useMemo(() => {
		if (!sourceIsCurrent) return null;
		if (!(Number.isInteger(currentSubtitleTrack) && currentSubtitleTrack >= 0)) {
			return mediaSourceData?.__debugSubtitlePolicy || null;
		}
		const settings = playbackSettingsRef?.current || {};
		const metadataPolicy = mediaSourceData?.__debugSubtitlePolicy || null;
		const policy = getSubtitleTranscodePolicy(mediaSourceData, currentSubtitleTrack, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
			assSubtitleRenderer: settings.assSubtitleRenderer,
			bitmapSubtitleRenderer: settings.bitmapSubtitleRenderer,
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			forceSubtitleBurnIn: settings.forceSubtitleBurnIn === true,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs,
			originalDynamicRangeInfo: metadataPolicy?.originalDynamicRangeInfo
		});
		return {
			...policy,
			originalDynamicRangeInfo: metadataPolicy?.originalDynamicRangeInfo || policy?.originalDynamicRangeInfo || null,
			originalDynamicRangeId: metadataPolicy?.originalDynamicRangeId || policy?.originalDynamicRangeId || null,
			clientRenderedStreamIndex: metadataPolicy?.clientRenderedStreamIndex ?? policy?.clientRenderedStreamIndex ?? null
		};
	}, [currentSubtitleTrack, mediaSourceData, playbackSettingsRef, sourceIsCurrent]);
	const shouldUseClientRenderer =
		sourceIsCurrent &&
		Number.isInteger(currentSubtitleTrack) &&
		currentSubtitleTrack >= 0 &&
		String(subtitlePolicy?.renderer || '').startsWith('client') &&
		subtitlePolicy?.clientRender === true;
	const subtitleKey = shouldUseClientRenderer
			? `${item?.Id || ''}:${mediaSourceData?.Id || ''}:${playbackGeneration}:${currentSubtitleTrack}`
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
			const rendererId = externalRendererRef.current.rendererId;
			const context = {containerElement: externalSubtitleLayerRef?.current};
			if (isExternalAssRendererId(rendererId)) {
				disposeExternalAssRenderer(rendererId, externalRendererRef.current.instance, context);
			} else if (isExternalBitmapRendererId(rendererId)) {
				disposeExternalBitmapRenderer(rendererId, externalRendererRef.current.instance, context);
			}
		}
		externalRendererRef.current = {
			rendererId: '',
			instance: null
		};
	}, [externalSubtitleLayerRef]);

	useEffect(() => {
		fallbackAttemptedKeysRef.current = new Set();
	}, [currentSubtitleTrack, item?.Id, mediaSourceData?.Id, playbackGeneration]);

	const fallbackToBurnIn = useCallback((reason) => {
		if (exitInProgressRef.current || !sourceIsCurrent) return 'failed';
		return runSubtitleBurnInFallbackDecision({
			reason,
			subtitlePolicy,
			subtitleKey,
			fallbackAttemptedKeys: fallbackAttemptedKeysRef.current,
			currentSubtitleTrack,
			onBurnInFallback: onBurnInFallbackRef.current,
			setToastMessage: setToastMessageRef.current
		});
	}, [
		currentSubtitleTrack,
		exitInProgressRef,
		sourceIsCurrent,
		subtitleKey,
		subtitlePolicy
	]);

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
			if (!sourceIsCurrent) {
				disposeCurrentExternalRenderer();
				setEvents([]);
				setState({
					renderer: 'off',
					status: 'off',
					error: '',
					fallbackReason: '',
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: {playbackGeneration, transition: 'waiting-source'}
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
		if (isExternalBitmapRendererId(rendererMode)) {
			disposeCurrentExternalRenderer();
			const videoElement = videoRef.current;
			const containerElement = externalSubtitleLayerRef?.current;
			let bitmapCancelled = false;
			const startedAt = Date.now();
			const buildBitmapDebug = (extra = {}) => ({
				cacheKey: subtitleKey,
				cacheHit: false,
				requestedRenderer: rendererMode,
				rawTried: BITMAP_SUBTITLE_RAW_FORMATS.join(','),
				externalStatus: 'loading',
				...extra
			});
			setEvents([]);
			setState({
				renderer: rendererMode,
				status: 'loading',
				error: '',
				fallbackReason: '',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: buildBitmapDebug()
			});
			(async () => {
				const deliveryResult = jellyfinService.getBitmapSubtitleDeliveryCandidates(
					item.Id,
					mediaSourceData,
					currentSubtitleTrack,
					BITMAP_SUBTITLE_RAW_FORMATS
				);
				if (bitmapCancelled || requestId !== requestIdRef.current) return;
				const deliveryCandidates = Array.isArray(deliveryResult?.candidates)
					? deliveryResult.candidates
					: [];
				let selectedCandidate = deliveryCandidates.find((candidate) => candidate?.source === 'delivery-url') || null;
				let binaryResult = null;
				let lastFetchError = '';
				const probeResults = [];
				if (!selectedCandidate) {
					for (const candidate of deliveryCandidates) {
						if (candidate?.source !== 'generated-raw') continue;
						const result = await jellyfinService.getSubtitleBinary(
							item.Id,
							mediaSourceData.Id,
							currentSubtitleTrack,
							candidate.format
						);
						if (bitmapCancelled || requestId !== requestIdRef.current) return;
						probeResults.push({
							format: candidate.format,
							path: candidate.path,
							ok: result?.ok === true,
							error: result?.error || '',
							contentType: result?.contentType || '',
							byteLength: result?.byteLength ?? result?.data?.byteLength ?? 0,
							pgsMagic: result?.pgsMagic === true
						});
						if (result?.ok === true && result.data instanceof ArrayBuffer) {
							selectedCandidate = candidate;
							binaryResult = result;
							break;
						}
						lastFetchError = normalizeSubtitleRendererFailureReason(result?.error, 'bitmap-fetch-failed');
					}
				}
				const fetchMs = Date.now() - startedAt;
				const fetchDebug = buildBitmapDeliveryFetchDebug({
					baseDebug: buildBitmapDebug(),
					selectedCandidate,
					binaryResult,
					deliveryCandidates,
					probeResults,
					fetchMs
				});
				if (!selectedCandidate) {
					const reason = lastFetchError || deliveryResult?.error || 'bitmap-delivery-unavailable';
					const bitmapFallbackStatus = fallbackToBurnIn(reason);
					setState({
						renderer: rendererMode,
						status: bitmapFallbackStatus,
						error: reason,
						fallbackReason: reason,
						eventCount: 0,
						cueCount: 0,
						activeCueCount: 0,
						debug: {
							...fetchDebug,
							externalStatus: 'fetch-failed'
						}
					});
					return;
				}
				if (!videoElement || !containerElement) {
					const reason = 'missing-bitmap-renderer-context';
					const bitmapFallbackStatus = fallbackToBurnIn(reason);
					setState({
						renderer: rendererMode,
						status: bitmapFallbackStatus,
						error: reason,
						fallbackReason: reason,
						eventCount: 0,
						cueCount: 0,
						activeCueCount: 0,
						debug: {
							...fetchDebug,
							externalStatus: 'missing-context'
						}
					});
					return;
				}
				const rendererSequence = getBitmapRendererSequence(rendererMode);
				let lastRendererDebug = null;
				let lastReason = 'bitmap-renderer-init-failed';
				for (const bitmapRendererId of rendererSequence) {
					if (!supportsExternalBitmapRenderer(bitmapRendererId)) {
						lastReason = `${bitmapRendererId}-unavailable`;
						lastRendererDebug = {
							engine: bitmapRendererId,
							externalStatus: 'unavailable'
						};
						continue;
					}
					const rendererResult = await initExternalBitmapRenderer(bitmapRendererId, {
						videoElement,
						containerElement,
						subtitleContent: binaryResult?.data || null,
						subtitleUrl: selectedCandidate.url || binaryResult?.url,
						sourceFormat: binaryResult?.format || selectedCandidate.format,
						diagnosticsEnabled: diagnosticsEnabledRef.current,
						onError: (error) => {
							if (bitmapCancelled || requestId !== requestIdRef.current) return;
							disposeCurrentExternalRenderer();
							const reason = normalizeSubtitleRendererFailureReason(error?.message, 'bitmap-renderer-runtime-error');
							const runtimeFallbackStatus = fallbackToBurnIn(reason);
							setState({
								renderer: bitmapRendererId,
								status: runtimeFallbackStatus,
								error: reason,
								fallbackReason: reason,
								eventCount: 0,
								cueCount: 0,
								activeCueCount: 0,
								debug: {
									...fetchDebug,
									externalStatus: 'runtime-error'
								}
							});
						}
					});
					if (bitmapCancelled || requestId !== requestIdRef.current) {
						disposeExternalBitmapRenderer(bitmapRendererId, rendererResult?.instance, {containerElement});
						return;
					}
					lastRendererDebug = rendererResult?.debug || null;
					if (!rendererResult?.instance) {
						lastReason = normalizeSubtitleRendererFailureReason(rendererResult?.debug?.error, 'bitmap-renderer-init-failed');
						continue;
					}
					externalRendererRef.current = {
						rendererId: bitmapRendererId,
						instance: rendererResult.instance
					};
					setState({
						renderer: bitmapRendererId,
						status: 'ready',
						error: '',
						fallbackReason: rendererMode === SUBTITLE_RENDERER_IDS.BITMAP_AUTO && bitmapRendererId !== SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB
							? 'libbitsub-fallback'
							: '',
						eventCount: 0,
						cueCount: rendererResult.debug?.bitmapCueCount || 0,
						activeCueCount: 0,
						debug: {
							...fetchDebug,
							...(rendererResult.debug || {}),
							requestedRenderer: rendererMode,
							externalStatus: 'ready',
							fetchMs
						}
					});
					return;
				}
				const fallbackStatus = fallbackToBurnIn(lastReason);
				setState({
					renderer: rendererMode,
					status: fallbackStatus,
					error: lastReason,
					fallbackReason: lastReason,
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: {
						...fetchDebug,
						...(lastRendererDebug || {}),
						externalStatus: 'init-failed'
					}
				});
			})().catch((error) => {
				if (bitmapCancelled || requestId !== requestIdRef.current) return;
				const reason = normalizeSubtitleRendererFailureReason(error?.message, 'bitmap-renderer-error');
				const fallbackStatus = fallbackToBurnIn(reason);
				setState({
					renderer: rendererMode,
					status: fallbackStatus,
					error: reason,
					fallbackReason: reason,
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: buildBitmapDebug({
						externalStatus: 'error',
						fetchMs: Date.now() - startedAt
					})
				});
			});
			return () => {
				bitmapCancelled = true;
				disposeCurrentExternalRenderer();
			};
		}
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
				if (![SUBTITLE_RENDERER_IDS.ASS_JASSUB, SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL].includes(rendererMode) || !rendererResult?.instance) return;
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
					const diagnostics = probeExternalRendererOutput({
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
					diagnosticsEnabled: diagnosticsEnabledRef.current,
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
		mediaSourceData,
		playbackGeneration,
		selectedSubtitleTrack,
		shouldUseClientRenderer,
		sourceIsCurrent,
		subtitleKey,
		subtitlePolicy?.codec,
		subtitlePolicy?.reason,
		subtitlePolicy?.renderer,
		videoRef
	]);

	useEffect(() => {
		if (!diagnosticsEnabled || !debugDiagnosticsEnabled || runtimeSuspended) return undefined;
		if (
			!isExternalAssRendererId(state.renderer) &&
			!isExternalBitmapRendererId(state.renderer)
		) return undefined;
		if (state.status !== 'ready') return undefined;
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
	}, [debugDiagnosticsEnabled, diagnosticsEnabled, externalSubtitleLayerRef, runtimeSuspended, state.renderer, state.status, videoRef]);

	useEffect(() => {
		const renderer = externalRendererRef.current.instance;
		if (typeof renderer?.__breezyfinSetRuntimeSuspended !== 'function') return;
		renderer.__breezyfinSetRuntimeSuspended(runtimeSuspended);
	}, [runtimeSuspended, state.renderer, state.status]);

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
		subtitleRendererState: state,
		requestSubtitleRendererFallback: fallbackToBurnIn
	};
};
