import {useCallback} from 'react';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	getSubtitleTranscodePolicy,
	shouldTranscodeForSubtitleSelection
} from '../../../utils/playbackSelection';
import {
	applyNativeAudioTrackSelection,
	resolveRuntimeTrackIndex
} from '../../../utils/trackMatching';
import {buildPlaybackOverride} from '../utils/playbackOverride';

const NATIVE_AUDIO_SWITCH_SETTLE_MS = 1000;

export const waitForNativeAudioTrackReadiness = (
	video,
	timeoutMs = NATIVE_AUDIO_SWITCH_SETTLE_MS
) => new Promise((resolve) => {
	let timer = null;
	let onReady = null;
	const readinessEvents = ['canplay', 'loadeddata'];
	const finish = (signal) => {
		if (timer !== null) clearTimeout(timer);
		readinessEvents.forEach((eventName) => video?.removeEventListener?.(eventName, onReady));
		resolve(signal);
	};
	onReady = (event) => finish(event?.type || 'media-ready');

	readinessEvents.forEach((eventName) => video?.addEventListener?.(eventName, onReady, {once: true}));
	timer = setTimeout(() => finish('settle-timeout'), timeoutMs);
});

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
	appendPlaybackDiagnostic
}) => {
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
	}, [checkSkipSegments, duration, seekFeedbackTimerRef, seekOffsetRef, setCurrentTime, setSeekFeedback, videoRef]);

	const handleSeek = useCallback(async (e) => {
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
		loadVideo();
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
		closeAudioPopup();

		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			const hls = hlsRef.current;
			const hlsTrack = resolveRuntimeTrackIndex({
				runtimeTracks: hls.audioTracks,
				mediaTracks: audioTracks,
				selectedTrackIndex: trackIndex
			});
			if (hlsTrack.index >= 0) {
				hls.audioTrack = hlsTrack.index;
				const applied = hls.audioTrack === hlsTrack.index;
				if (typeof appendPlaybackDiagnostic === 'function') {
					appendPlaybackDiagnostic({
						scope: 'audio-track',
						stage: 'hls-switch',
						status: applied ? 'applied' : 'failed',
						reason: hlsTrack.method,
						message: applied
							? `Selected HLS audio track ${hlsTrack.index}.`
							: `HLS.js rejected audio track ${hlsTrack.index}; reloading the stream.`
					});
				}
				if (applied) {
					setCurrentAudioTrack(trackIndex);
					saveAudioSelection(trackIndex, audioTracks);
					return;
				}
			}
		}

		const video = videoRef.current;
		const sourceToken = nativeSourceTokenRef?.current || null;
		const sourceIdentity = video?.currentSrc || video?.src || '';
		const shouldResume = Boolean(video && !video.paused && !video.ended);
		if (shouldResume) video.pause();
		const nativeResult = applyNativeAudioTrackSelection({
			video,
			mediaTracks: audioTracks,
			selectedTrackIndex: trackIndex
		});
		if (typeof appendPlaybackDiagnostic === 'function') {
			appendPlaybackDiagnostic({
				scope: 'audio-track',
				stage: 'native-switch',
				status: nativeResult.status,
				reason: nativeResult.method,
				message: nativeResult.applied
					? `Selected native audio track ${nativeResult.index}.`
					: 'Native audio track switching unavailable or failed.'
			});
		}
		if (nativeResult.applied) {
			setCurrentAudioTrack(trackIndex);
			saveAudioSelection(trackIndex, audioTracks);
			if (shouldResume) {
				const readinessSignal = await waitForNativeAudioTrackReadiness(video);
				const activeVideo = videoRef.current;
				const activeSourceIdentity = activeVideo?.currentSrc || activeVideo?.src || '';
				const sourceStillCurrent = sourceToken
					? nativeSourceTokenRef?.current === sourceToken
					: activeSourceIdentity === sourceIdentity;
				if (activeVideo === video && sourceStillCurrent) {
					try {
						await Promise.resolve(video.play());
						appendPlaybackDiagnostic?.({
							scope: 'audio-track',
							stage: 'native-resume',
							status: 'applied',
							reason: readinessSignal,
							message: 'Resumed playback after the native audio track settled.'
						});
					} catch (error) {
						appendPlaybackDiagnostic?.({
							scope: 'audio-track',
							stage: 'native-resume',
							status: 'failed',
							reason: error?.name || 'play-rejected',
							message: 'Native audio track changed, but automatic playback resume failed.'
						});
						setToastMessage({
							message: 'Audio track changed. Press Play to resume.',
							severity: 'warning'
						});
					}
				}
			}
			return;
		}

		setCurrentAudioTrack(trackIndex);
		saveAudioSelection(trackIndex, audioTracks);
		await reloadWithTrackSelection(trackIndex, currentSubtitleTrack, {
			disableDirectPlay: true,
			reason: nativeResult.status || 'native-audio-switch-failed'
		});
	}, [
		appendPlaybackDiagnostic,
		audioTracks,
		closeAudioPopup,
		currentSubtitleTrack,
		hlsRef,
		nativeSourceTokenRef,
		reloadWithTrackSelection,
		saveAudioSelection,
		setCurrentAudioTrack,
		setToastMessage,
		videoRef
	]);

	const handleSubtitleTrackChange = useCallback(async (trackIndex) => {
		setCurrentSubtitleTrack(trackIndex);
		closeSubtitlePopup();
		saveSubtitleSelection(trackIndex, subtitleTracks);

		if (shouldForceSubtitleReload(trackIndex)) {
			setToastMessage({
				message: 'Subtitle burn-in requires stream reload.',
				severity: 'warning'
			});
			reloadWithTrackSelection(currentAudioTrack, trackIndex);
			return;
		}

		if (shouldUseClientSubtitleRenderer(trackIndex)) {
			setToastMessage('Rendering subtitles in app.');
			return;
		}

		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hlsTrackIndex = resolveRuntimeTrackIndex({
					runtimeTracks: hlsRef.current.subtitleTracks,
					mediaTracks: subtitleTracks,
					selectedTrackIndex: trackIndex
				});
				if (hlsTrackIndex.index >= 0) {
					hlsRef.current.subtitleTrack = hlsTrackIndex.index;
					return;
				}
			}
			setToastMessage({
				message: 'Subtitle change may require retry/reload on this stream',
				severity: 'warning'
			});
		}

		reloadWithTrackSelection(currentAudioTrack, trackIndex);
	}, [
		closeSubtitlePopup,
		currentAudioTrack,
		hlsRef,
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
