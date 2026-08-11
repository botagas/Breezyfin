import {useCallback, useEffect, useRef} from 'react';
import Hls from 'hls.js';

import {createHlsPlayerConfig} from '../constants';
import {
	createNativePlaybackSourceToken,
	isNativePlaybackSourceTokenCurrent,
	isPlaybackSourceMediaEventCurrent
} from '../utils/playbackRuntimeContext';
import {selectHlsEnginePreference} from '../utils/playerVideoLoaderHelpers';
import {PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS} from '../utils/playerStartupState';
import {createHlsStartupMeasurements} from '../utils/hlsStartupMeasurements';

const NATIVE_HLS_FALLBACK_TIMEOUT_MS = 3500;

const safelyResetVideo = (video) => {
	if (!video) return;
	try {
		video.pause();
	} catch (_) {
		// Native media teardown is best-effort.
	}
	try {
		video.removeAttribute('src');
		video.load();
	} catch (_) {
		// The next source attachment will surface a usable error if reset failed.
	}
};

export const usePlayerSourcePipeline = ({
	videoRef,
	hlsRef,
	nativeHlsFallbackCleanupRef,
	nativeSourceTokenRef,
	playbackRuntimeContextRef,
	playbackGenerationRef,
	exitInProgressRef,
	hlsConfig,
	diagnosticsEnabled = false,
	appendPlaybackDiagnostic,
	onPlaybackSourceAttached,
	onPlaybackSourceInvalidated,
	onPlaybackEngineReady,
	onHlsRuntimeError,
	onHlsBootstrapTimeout
}) => {
	const sourceGenerationRef = useRef(0);
	const hlsBootstrapTimerRef = useRef(null);
	const activeDescriptorRef = useRef(null);
	const videoResetRef = useRef(false);
	const callbackRefs = useRef({});
	const hlsMeasurementsRef = useRef(null);
	if (
		!hlsMeasurementsRef.current ||
		hlsMeasurementsRef.current.enabled !== diagnosticsEnabled ||
		hlsMeasurementsRef.current.appendPlaybackDiagnostic !== appendPlaybackDiagnostic
	) {
		hlsMeasurementsRef.current = {
			enabled: diagnosticsEnabled,
			appendPlaybackDiagnostic,
			tracker: createHlsStartupMeasurements({
				enabled: diagnosticsEnabled,
				appendDiagnostic: appendPlaybackDiagnostic
			})
		};
	}
	callbackRefs.current = {
		onPlaybackSourceAttached,
		onPlaybackSourceInvalidated,
		onPlaybackEngineReady,
		onHlsRuntimeError,
		onHlsBootstrapTimeout
	};

	const clearHlsBootstrapDeadline = useCallback(() => {
		if (!hlsBootstrapTimerRef.current) return;
		clearTimeout(hlsBootstrapTimerRef.current);
		hlsBootstrapTimerRef.current = null;
	}, []);

	const clearNativeHlsFallback = useCallback(() => {
		if (typeof nativeHlsFallbackCleanupRef?.current === 'function') {
			nativeHlsFallbackCleanupRef.current();
		}
		nativeHlsFallbackCleanupRef.current = null;
	}, [nativeHlsFallbackCleanupRef]);

	const destroyHls = useCallback(() => {
		clearHlsBootstrapDeadline();
		const hls = hlsRef.current;
		if (!hls) return;
		try {
			hls.stopLoad?.();
		} catch (_) {
			// Continue with destruction.
		}
		try {
			hls.destroy();
		} catch (error) {
			console.warn('Error destroying HLS instance:', error);
		}
		if (hlsRef.current === hls) {
			hlsRef.current = null;
		}
	}, [clearHlsBootstrapDeadline, hlsRef]);

	const detachSource = useCallback(({
		clearRuntimeContext = true,
		resetVideo = true,
		reason = 'source-detached'
	} = {}) => {
		const video = videoRef.current;
		const previousSourceToken = nativeSourceTokenRef.current;
		const hadActiveSource = Boolean(
			nativeSourceTokenRef.current ||
			hlsRef.current ||
			activeDescriptorRef.current ||
			nativeHlsFallbackCleanupRef.current
		);
		clearNativeHlsFallback();
		hlsMeasurementsRef.current?.tracker.clear(previousSourceToken);
		activeDescriptorRef.current = null;
		nativeSourceTokenRef.current = null;
		if (clearRuntimeContext) {
			playbackRuntimeContextRef.current = null;
		}
		if (hadActiveSource || !videoResetRef.current) {
			callbackRefs.current.onPlaybackSourceInvalidated?.();
		}
		destroyHls();
		if (resetVideo && (hadActiveSource || !videoResetRef.current)) {
			safelyResetVideo(video);
			videoResetRef.current = true;
		}
		if (hadActiveSource) {
			appendPlaybackDiagnostic?.({
				scope: 'source-pipeline',
				stage: 'detach',
				status: 'applied',
				reason,
				message: 'The active playback source was detached.'
			});
		}
		return hadActiveSource;
	}, [
		appendPlaybackDiagnostic,
		clearNativeHlsFallback,
		destroyHls,
		hlsRef,
		nativeHlsFallbackCleanupRef,
		nativeSourceTokenRef,
		playbackRuntimeContextRef,
		videoRef
	]);

	const isSourceTokenCurrent = useCallback((sourceToken, hls = null) => (
		isNativePlaybackSourceTokenCurrent({
			sourceToken,
			activeSourceToken: nativeSourceTokenRef.current,
			activeRuntimeContext: playbackRuntimeContextRef.current,
			generation: playbackGenerationRef.current,
			exitInProgress: exitInProgressRef.current
		}) &&
		(!hls || hlsRef.current === hls)
	), [
		exitInProgressRef,
		hlsRef,
		nativeSourceTokenRef,
		playbackGenerationRef,
		playbackRuntimeContextRef
	]);

	const isSourceMediaEventCurrent = useCallback((event, sourceToken) => (
		isPlaybackSourceMediaEventCurrent({
			event,
			sourceToken,
			activeSourceToken: nativeSourceTokenRef.current,
			activeRuntimeContext: playbackRuntimeContextRef.current,
			generation: playbackGenerationRef.current,
			exitInProgress: exitInProgressRef.current
		})
	), [
		exitInProgressRef,
		nativeSourceTokenRef,
		playbackGenerationRef,
		playbackRuntimeContextRef
	]);

	const createSourceToken = useCallback((descriptor, engine) => {
		const sourceToken = createNativePlaybackSourceToken({
			runtimeContext: descriptor.runtimeContext,
			video: videoRef.current,
			sourceUrl: descriptor.url,
			engine,
			sourceGeneration: ++sourceGenerationRef.current,
			serverBurnIn: descriptor.serverBurnIn
		});
		nativeSourceTokenRef.current = sourceToken;
		activeDescriptorRef.current = descriptor;
		return sourceToken;
	}, [nativeSourceTokenRef, videoRef]);

	const attachHlsJsSource = useCallback((descriptor, {
		reason = 'hlsjs-selected',
		resetCurrentSource = true
	} = {}) => {
		const video = videoRef.current;
		if (!video) {
			throw new Error('Video element not available');
		}
		if (resetCurrentSource && (nativeSourceTokenRef.current || hlsRef.current)) {
			detachSource({
				clearRuntimeContext: false,
				resetVideo: true,
				reason: 'hlsjs-source-replacement'
			});
		}
		if (!videoResetRef.current) {
			safelyResetVideo(video);
			videoResetRef.current = true;
		}

		const hls = new Hls(createHlsPlayerConfig(hlsConfig));
		hlsRef.current = hls;
		const sourceToken = createSourceToken(descriptor, 'hls.js');
		hlsMeasurementsRef.current?.tracker.begin(sourceToken);
		callbackRefs.current.onPlaybackSourceAttached?.(sourceToken, {engineReady: false});
		descriptor.onEngineSelected?.('hls.js');
		appendPlaybackDiagnostic?.({
			scope: 'hls-engine',
			stage: 'select',
			status: 'applied',
			reason,
			message: `Using HLS.js playback for source generation ${sourceToken.sourceGeneration}.`
		});

		const attachedAt = Date.now();
		let manifestAt = 0;
		let engineReady = false;

		hls.on(Hls.Events.MEDIA_ATTACHED, () => {
			if (!isSourceTokenCurrent(sourceToken, hls)) return;
			hlsMeasurementsRef.current?.tracker.mediaAttached(sourceToken);
			appendPlaybackDiagnostic?.({
				scope: 'hls-engine',
				stage: 'media-attached',
				status: 'ready',
				reason: 'hlsjs-media-source',
				message: `HLS.js attached after ${Date.now() - attachedAt} ms.`
			});
			hls.loadSource(descriptor.url);
		});

		hls.on(Hls.Events.MANIFEST_PARSED, () => {
			if (!isSourceTokenCurrent(sourceToken, hls)) return;
			hlsMeasurementsRef.current?.tracker.manifestParsed(sourceToken);
			manifestAt = Date.now();
			appendPlaybackDiagnostic?.({
				scope: 'hls-engine',
				stage: 'manifest-parsed',
				status: 'ready',
				reason: 'hlsjs-manifest',
				message: `HLS.js parsed the manifest after ${manifestAt - attachedAt} ms.`
			});
		});

		hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
			if (isSourceTokenCurrent(sourceToken, hls)) {
				hlsMeasurementsRef.current?.tracker.fragmentBuffered(
					sourceToken,
					data?.frag,
					video
				);
			}
			if (engineReady || !isSourceTokenCurrent(sourceToken, hls)) return;
			engineReady = true;
			clearHlsBootstrapDeadline();
			const now = Date.now();
			appendPlaybackDiagnostic?.({
				scope: 'hls-engine',
				stage: 'first-fragment-buffered',
				status: 'ready',
				reason: 'hlsjs-fragment',
				message: `HLS.js buffered its first fragment after ${now - attachedAt} ms${manifestAt ? ` (${now - manifestAt} ms after manifest)` : ''}.`
			});
			callbackRefs.current.onPlaybackEngineReady?.(sourceToken, 'first-fragment-buffered');
		});

		hls.on(Hls.Events.ERROR, (event, data) => {
			if (!isSourceTokenCurrent(sourceToken, hls)) return;
			hlsMeasurementsRef.current?.tracker.recovery(
				sourceToken,
				data?.details || data?.type || 'hls-error'
			);
			Promise.resolve(callbackRefs.current.onHlsRuntimeError?.({
				hls,
				event,
				data,
				sourceLabel: 'HLS.js',
				runtimeContext: descriptor.runtimeContext,
				sourceToken
			})).catch((error) => {
				console.warn('Failed to handle HLS.js runtime error:', error);
			});
		});

		hlsBootstrapTimerRef.current = setTimeout(() => {
			hlsBootstrapTimerRef.current = null;
			if (engineReady || !isSourceTokenCurrent(sourceToken, hls)) return;
			hlsMeasurementsRef.current?.tracker.recovery(sourceToken, 'hls-bootstrap-timeout');
			appendPlaybackDiagnostic?.({
				scope: 'hls-engine',
				stage: 'bootstrap-timeout',
				status: 'failed',
				reason: 'hls-engine-no-fragment',
				message: 'HLS.js did not buffer a fragment before the engine bootstrap deadline.'
			});
			Promise.resolve(callbackRefs.current.onHlsBootstrapTimeout?.({
				hls,
				runtimeContext: descriptor.runtimeContext,
				sourceToken
			})).catch((error) => {
				console.warn('Failed to handle HLS.js bootstrap timeout:', error);
			});
		}, PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS);

		hls.attachMedia(video);
		videoResetRef.current = false;
		return sourceToken;
	}, [
		appendPlaybackDiagnostic,
		clearHlsBootstrapDeadline,
		createSourceToken,
		detachSource,
		hlsConfig,
		hlsRef,
		isSourceTokenCurrent,
		nativeSourceTokenRef,
		videoRef
	]);

	const attachNativeSource = useCallback((descriptor, {
		allowHlsJsFallback = false,
		hlsJsSupported = false,
		nativeMimeResults = null
	} = {}) => {
		const video = videoRef.current;
		if (!video) {
			throw new Error('Video element not available');
		}
		if (nativeSourceTokenRef.current || hlsRef.current) {
			detachSource({
				clearRuntimeContext: false,
				resetVideo: true,
				reason: 'native-source-replacement'
			});
		}
		if (!videoResetRef.current) {
			safelyResetVideo(video);
		}

		const engine = descriptor.isHls ? 'native-hls' : 'native';
		const sourceToken = createSourceToken(descriptor, engine);
		callbackRefs.current.onPlaybackSourceAttached?.(sourceToken, {engineReady: true});
		descriptor.onEngineSelected?.(engine);
		appendPlaybackDiagnostic?.({
			scope: descriptor.isHls ? 'hls-engine' : 'source-pipeline',
			stage: descriptor.isHls ? 'select' : 'native-attach',
			status: 'applied',
			reason: descriptor.isHls ? 'native-available' : descriptor.playMethod,
			message: descriptor.isHls
				? `Using native HLS playback (${JSON.stringify(nativeMimeResults || {})}).`
				: `Using native ${descriptor.playMethod || 'playback'}.`
		});

		video.src = descriptor.url;

		if (descriptor.isHls && allowHlsJsFallback && hlsJsSupported) {
			let fallbackTriggered = false;
			let fallbackTimer = null;
			let handleError = null;
			let handleStartupEvidence = null;
			const startupInitialTime = Number(video.currentTime) || 0;
			const cleanup = () => {
				if (fallbackTimer) {
					clearTimeout(fallbackTimer);
					fallbackTimer = null;
				}
				if (handleError) {
					video.removeEventListener('error', handleError);
				}
				if (handleStartupEvidence) {
					video.removeEventListener('canplay', handleStartupEvidence);
					video.removeEventListener('playing', handleStartupEvidence);
					video.removeEventListener('timeupdate', handleStartupEvidence);
				}
				if (nativeHlsFallbackCleanupRef.current === cleanup) {
					nativeHlsFallbackCleanupRef.current = null;
				}
			};
			const startHlsJsFallback = (fallbackReason) => {
				if (
					fallbackTriggered ||
					!isSourceTokenCurrent(sourceToken) ||
					exitInProgressRef.current
				) return;
				fallbackTriggered = true;
				cleanup();
				appendPlaybackDiagnostic?.({
					scope: 'hls-engine',
					stage: 'fallback',
					status: 'applied',
					reason: fallbackReason,
					message: 'Native HLS fallback started with HLS.js.'
				});
				attachHlsJsSource(descriptor, {
					reason: fallbackReason,
					resetCurrentSource: true
				});
			};
			handleError = (event) => {
				if (!isSourceMediaEventCurrent(event, sourceToken)) return;
				startHlsJsFallback('native-hls-error');
			};
			handleStartupEvidence = (event) => {
				if (!isSourceMediaEventCurrent(event, sourceToken)) return;
				const progressed = event?.type !== 'timeupdate' ||
					Math.abs((Number(video.currentTime) || 0) - startupInitialTime) >= 0.25;
				if (progressed) cleanup();
			};

			fallbackTimer = setTimeout(() => {
				if (isSourceTokenCurrent(sourceToken)) {
					startHlsJsFallback('native-hls-timeout');
				}
			}, NATIVE_HLS_FALLBACK_TIMEOUT_MS);
			nativeHlsFallbackCleanupRef.current = cleanup;
			video.addEventListener('error', handleError, {once: true});
			video.addEventListener('canplay', handleStartupEvidence, {once: true});
			video.addEventListener('playing', handleStartupEvidence, {once: true});
			video.addEventListener('timeupdate', handleStartupEvidence);
		}

		video.load();
		videoResetRef.current = false;
		return sourceToken;
	}, [
		appendPlaybackDiagnostic,
		attachHlsJsSource,
		createSourceToken,
		detachSource,
		exitInProgressRef,
		hlsRef,
		isSourceMediaEventCurrent,
		isSourceTokenCurrent,
		nativeHlsFallbackCleanupRef,
		nativeSourceTokenRef,
		videoRef
	]);

	const attachSource = useCallback((descriptor) => {
		if (!descriptor?.runtimeContext || !descriptor?.url) {
			throw new Error('Playback source descriptor is incomplete');
		}
		if (
			exitInProgressRef.current ||
			descriptor.runtimeContext.generation !== playbackGenerationRef.current
		) {
			return null;
		}
		if (!descriptor.isHls) {
			return attachNativeSource(descriptor);
		}

		const video = videoRef.current;
		const nativeMimeResults = {
			'application/vnd.apple.mpegURL': video?.canPlayType?.('application/vnd.apple.mpegURL') || '',
			'application/x-mpegURL': video?.canPlayType?.('application/x-mpegURL') || ''
		};
		const nativeHlsSupported = Boolean(
			nativeMimeResults['application/vnd.apple.mpegURL'] ||
			nativeMimeResults['application/x-mpegURL']
		);
		const hlsJsSupported = Hls.isSupported();
		const preference = selectHlsEnginePreference({
			isHls: true,
			isHdrLikeStream: descriptor.isHdrLikeStream,
			nativeHlsSupported,
			hlsJsSupported
		});
		if (preference.engine === 'native') {
			return attachNativeSource(descriptor, {
				allowHlsJsFallback: preference.allowNativeFallback,
				hlsJsSupported,
				nativeMimeResults
			});
		}
		if (preference.engine === 'hls.js') {
			return attachHlsJsSource(descriptor, {
				reason: preference.reason,
				resetCurrentSource: true
			});
		}
		appendPlaybackDiagnostic?.({
			scope: 'hls-engine',
			stage: 'select',
			status: 'failed',
			reason: preference.reason,
			message: 'No supported HLS playback engine is available.'
		});
		throw new Error('HLS playback not supported on this device');
	}, [
		appendPlaybackDiagnostic,
		attachHlsJsSource,
		attachNativeSource,
		exitInProgressRef,
		playbackGenerationRef,
		videoRef
	]);

	const detachSourceRef = useRef(detachSource);
	detachSourceRef.current = detachSource;
	useEffect(() => () => {
		detachSourceRef.current({
			clearRuntimeContext: true,
			resetVideo: true,
			reason: 'source-pipeline-unmount'
		});
	}, []);

	return {
		attachSource,
		detachSource,
		isSourceTokenCurrent,
		clearHlsBootstrapDeadline,
		getActiveSource: () => nativeSourceTokenRef.current,
		getActiveDescriptor: () => activeDescriptorRef.current,
		recordPlaybackSignal: (sourceToken, signal) => (
			hlsMeasurementsRef.current?.tracker.playbackSignal(sourceToken, signal) ?? false
		),
		recordPlaybackRecovery: (sourceToken, reason) => (
			hlsMeasurementsRef.current?.tracker.recovery(sourceToken, reason) ?? false
		)
	};
};
