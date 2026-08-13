import {useCallback, useRef} from 'react';
import Hls from 'hls.js';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	getSubtitleTranscodePolicy,
	shouldTranscodeForSubtitleSelection
} from '../../../utils/playbackSelection';
import {resolveRuntimeTrackIndex} from '../../../utils/trackMatching';
import {buildPlaybackOverride} from '../utils/playbackOverride';
import {waitForHlsTrackSwitch} from '../utils/hlsTrackSwitch';

export const usePlayerSeekAndTrackSwitching = ({
	videoRef,
	hlsRef,
	nativeSourceTokenRef,
	duration,
	isCurrentTranscoding,
	mediaSourceData,
	checkSkipSegments,
	playbackOptions,
	playbackSettingsRef,
	currentAudioTrack,
	currentSubtitleTrack,
	reportPlaybackProgressNow,
	handleStop,
	loadVideo,
	playbackOverrideRef,
	lastInteractionRef,
	seekOffsetRef,
	seekFeedbackTimerRef,
	setCurrentTime,
	setLoading,
	setSeekFeedback,
	audioTracks,
	subtitleTracks,
	closeAudioPopup,
	closeSubtitlePopup,
	saveAudioSelection,
	saveSubtitleSelection,
	setCurrentAudioTrack,
	setCurrentSubtitleTrack,
	setToastMessage,
	dismissToast,
	requestAudioTransition,
	isTrackTransitionActive,
	setInlineAudioSwitchActive,
	appendPlaybackDiagnostic
}) => {
	const trackOperationIdRef = useRef(0);
	const isSeekContext = useCallback((target) => {
		if (!target) return true;
		if (target === videoRef.current || target === document.body || target === document.documentElement) return true;
		if (target.closest && target.closest('[data-seekable="true"]')) return true;
		return false;
	}, [videoRef]);

	const isProgressSliderTarget = useCallback((target) => {
		if (!target) return false;
		return Boolean(target.closest?.('[data-player-progress-slider="true"]'));
	}, []);

	const seekBySeconds = useCallback((deltaSeconds) => {
		if (isTrackTransitionActive?.()) return;
		const video = videoRef.current;
		if (!video || !Number.isFinite(deltaSeconds)) return;
		const nextTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), duration || video.duration || 0);
		video.currentTime = nextTime;
		const actualTime = nextTime + seekOffsetRef.current;
		setCurrentTime(actualTime);
		checkSkipSegments(actualTime);
		setSeekFeedback(`${deltaSeconds > 0 ? '+' : '-'}${Math.abs(deltaSeconds)}s`);
		if (seekFeedbackTimerRef.current) {
			clearTimeout(seekFeedbackTimerRef.current);
		}
		seekFeedbackTimerRef.current = setTimeout(() => {
			setSeekFeedback('');
			seekFeedbackTimerRef.current = null;
		}, 900);
	}, [checkSkipSegments, duration, isTrackTransitionActive, seekFeedbackTimerRef, seekOffsetRef, setCurrentTime, setSeekFeedback, videoRef]);

	const handleSeek = useCallback(async (e) => {
		if (isTrackTransitionActive?.()) return;
		const seekTime = e.value;
		setCurrentTime(seekTime);
		checkSkipSegments(seekTime);

		if (!videoRef.current) return;

		lastInteractionRef.current = Date.now();
		const isHls = isCurrentTranscoding && (
			mediaSourceData?.TranscodingUrl?.includes('.m3u8') ||
			mediaSourceData?.TranscodingUrl?.includes('/hls/')
		);

		if (isHls) {
			videoRef.current.currentTime = seekTime;
			await reportPlaybackProgressNow(videoRef.current.paused);
			return;
		}

		if (isCurrentTranscoding) {
			try {
				const seekTicks = Math.floor(seekTime * JELLYFIN_TICKS_PER_SECOND);
				setLoading(true);
				playbackOverrideRef.current = buildPlaybackOverride({
					baseOptions: playbackOptions,
					mediaSourceId: mediaSourceData?.Id,
					audioStreamIndex: currentAudioTrack,
					subtitleStreamIndex: currentSubtitleTrack,
					startTimeTicks: seekTicks,
					seekSeconds: seekTime
				});
				await handleStop();
				loadVideo();
			} catch (err) {
				console.error('Failed to seek:', err);
				setLoading(false);
			}
			return;
		}

		videoRef.current.currentTime = seekTime;
	}, [
		checkSkipSegments,
		currentAudioTrack,
		currentSubtitleTrack,
		handleStop,
		isCurrentTranscoding,
		isTrackTransitionActive,
		lastInteractionRef,
		loadVideo,
		mediaSourceData,
		playbackOptions,
		playbackOverrideRef,
		reportPlaybackProgressNow,
		setCurrentTime,
		setLoading,
		videoRef
	]);

	const reloadWithTrackSelection = useCallback(async (audioIndex, subtitleIndex, options = {}) => {
		if (!videoRef.current) return;
		const currentPosition = videoRef.current.currentTime || 0;
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: audioIndex,
			subtitleStreamIndex: subtitleIndex,
			seekSeconds: currentPosition,
			extra: {
				disableDirectPlay: options.disableDirectPlay === true
			}
		});
		if (typeof appendPlaybackDiagnostic === 'function' && options.reason) {
			appendPlaybackDiagnostic({
				scope: 'audio-track',
				stage: 'stream-reload',
				status: options.disableDirectPlay ? 'directplay-disabled' : 'requested',
				reason: options.reason,
				message: options.disableDirectPlay
					? 'Reloading with DirectPlay disabled so Jellyfin can honor AudioStreamIndex.'
					: 'Reloading stream for selected track.'
			});
		}
		setLoading(true);
		await handleStop();
		return loadVideo();
	}, [
		appendPlaybackDiagnostic,
		handleStop,
		loadVideo,
		mediaSourceData?.Id,
		playbackOptions,
		playbackOverrideRef,
		setLoading,
		videoRef
	]);

	const shouldForceSubtitleReload = useCallback((trackIndex) => {
		if (!(Number.isInteger(trackIndex) && trackIndex >= 0)) return false;
		const settings = playbackSettingsRef?.current || {};
		return shouldTranscodeForSubtitleSelection(mediaSourceData, trackIndex, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
			assSubtitleRenderer: settings.assSubtitleRenderer,
			bitmapSubtitleRenderer: settings.bitmapSubtitleRenderer,
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs
		});
	}, [mediaSourceData, playbackSettingsRef]);

	const shouldUseClientSubtitleRenderer = useCallback((trackIndex) => {
		if (!(Number.isInteger(trackIndex) && trackIndex >= 0)) return false;
		const settings = playbackSettingsRef?.current || {};
		const policy = getSubtitleTranscodePolicy(mediaSourceData, trackIndex, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
			assSubtitleRenderer: settings.assSubtitleRenderer,
			bitmapSubtitleRenderer: settings.bitmapSubtitleRenderer,
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs
		});
		return policy.clientRender === true;
	}, [mediaSourceData, playbackSettingsRef]);

	const handleAudioTrackChange = useCallback(async (trackIndex) => {
		if (isTrackTransitionActive?.() || trackIndex === currentAudioTrack) return;
		const operationId = ++trackOperationIdRef.current;
		closeAudioPopup();

		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			const hls = hlsRef.current;
			const sourceToken = nativeSourceTokenRef?.current || null;
			const hlsTrack = resolveRuntimeTrackIndex({
				runtimeTracks: hls.audioTracks,
				mediaTracks: audioTracks,
				selectedTrackIndex: trackIndex
			});
			if (hlsTrack.index >= 0) {
				setInlineAudioSwitchActive?.(true);
				setToastMessage({
					key: 'audio-track-switch',
					message: 'Switching audio...',
					severity: 'warning',
					persistent: true
				});
				let switchResult;
				try {
					switchResult = await waitForHlsTrackSwitch({
						hls,
						eventName: Hls.Events.AUDIO_TRACK_SWITCHED,
						expectedTrackId: hlsTrack.index,
						apply: () => {
							hls.audioTrack = hlsTrack.index;
						},
						isCurrent: () => (
							trackOperationIdRef.current === operationId &&
							hlsRef.current === hls &&
							nativeSourceTokenRef?.current === sourceToken
						)
					});
				} finally {
					setInlineAudioSwitchActive?.(false);
				}
				if (
					switchResult.reason === 'stale-source' ||
					trackOperationIdRef.current !== operationId
				) return;
				const applied = switchResult.confirmed;
				if (typeof appendPlaybackDiagnostic === 'function') {
					appendPlaybackDiagnostic({
						scope: 'audio-track',
						stage: 'hls-switch',
						status: applied ? 'applied' : 'failed',
						reason: applied ? hlsTrack.method : switchResult.reason,
						message: applied
							? `Selected HLS audio track ${hlsTrack.index}.`
							: `HLS.js rejected audio track ${hlsTrack.index}; reloading the stream.`
					});
				}
				if (applied && trackOperationIdRef.current === operationId) {
					dismissToast?.('audio-track-switch');
					setCurrentAudioTrack(trackIndex);
					saveAudioSelection(trackIndex, audioTracks);
					return;
				}
			}
		}
		dismissToast?.('audio-track-switch');
		if (trackOperationIdRef.current !== operationId) return;
		await requestAudioTransition?.(trackIndex);
	}, [
		appendPlaybackDiagnostic,
		audioTracks,
		closeAudioPopup,
		currentAudioTrack,
		dismissToast,
		hlsRef,
		isTrackTransitionActive,
		nativeSourceTokenRef,
		requestAudioTransition,
		saveAudioSelection,
		setCurrentAudioTrack,
		setInlineAudioSwitchActive,
		setToastMessage
	]);

	const handleSubtitleTrackChange = useCallback(async (trackIndex) => {
		if (isTrackTransitionActive?.() || trackIndex === currentSubtitleTrack) return;
		const operationId = ++trackOperationIdRef.current;
		closeSubtitlePopup();

		if (shouldForceSubtitleReload(trackIndex)) {
			setToastMessage({
				message: 'Subtitle burn-in requires stream reload.',
				severity: 'warning'
			});
			const burnInLoadResult = await reloadWithTrackSelection(currentAudioTrack, trackIndex);
			if (trackOperationIdRef.current !== operationId || burnInLoadResult?.status !== 'attached') return;
			setCurrentSubtitleTrack(trackIndex);
			saveSubtitleSelection(trackIndex, subtitleTracks);
			return;
		}

		if (shouldUseClientSubtitleRenderer(trackIndex)) {
			setCurrentSubtitleTrack(trackIndex);
			saveSubtitleSelection(trackIndex, subtitleTracks);
			setToastMessage('Rendering subtitles in app.');
			return;
		}

		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hls = hlsRef.current;
				const sourceToken = nativeSourceTokenRef?.current || null;
				const hlsTrackIndex = resolveRuntimeTrackIndex({
					runtimeTracks: hlsRef.current.subtitleTracks,
					mediaTracks: subtitleTracks,
					selectedTrackIndex: trackIndex
				});
				if (hlsTrackIndex.index >= 0) {
					const switchResult = await waitForHlsTrackSwitch({
						hls,
						eventName: Hls.Events.SUBTITLE_TRACK_LOADED,
						expectedTrackId: hlsTrackIndex.index,
						apply: () => {
							hls.subtitleTrack = hlsTrackIndex.index;
						},
						isCurrent: () => (
							trackOperationIdRef.current === operationId &&
							hlsRef.current === hls &&
							nativeSourceTokenRef?.current === sourceToken
						)
					});
					if (
						switchResult.reason === 'stale-source' ||
						trackOperationIdRef.current !== operationId
					) return;
					if (switchResult.confirmed) {
						setCurrentSubtitleTrack(trackIndex);
						saveSubtitleSelection(trackIndex, subtitleTracks);
						return;
					}
				}
			}
			setToastMessage({
				message: 'Subtitle change may require retry/reload on this stream',
				severity: 'warning'
			});
		}

		const loadResult = await reloadWithTrackSelection(currentAudioTrack, trackIndex);
		if (trackOperationIdRef.current !== operationId || loadResult?.status !== 'attached') return;
		setCurrentSubtitleTrack(trackIndex);
		saveSubtitleSelection(trackIndex, subtitleTracks);
	}, [
		closeSubtitlePopup,
		currentAudioTrack,
		currentSubtitleTrack,
		hlsRef,
		isTrackTransitionActive,
		nativeSourceTokenRef,
		reloadWithTrackSelection,
		saveSubtitleSelection,
		setCurrentSubtitleTrack,
		shouldForceSubtitleReload,
		shouldUseClientSubtitleRenderer,
		setToastMessage,
		subtitleTracks
	]);

	return {
		isSeekContext,
		isProgressSliderTarget,
		seekBySeconds,
		handleSeek,
		handleAudioTrackChange,
		handleSubtitleTrackChange
	};
};
