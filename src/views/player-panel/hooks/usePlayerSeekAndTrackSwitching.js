import {useCallback} from 'react';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';
import {
	getSubtitleTranscodePolicy,
	shouldTranscodeForSubtitleSelection
} from '../../../services/jellyfin/playbackSelection';
import {buildPlaybackOverride} from '../utils/playbackOverride';

const normalizeTrackToken = (value) => String(value || '').trim().toLowerCase();

const findUniqueTrackMatchIndex = (tracks, matcher) => {
	if (!Array.isArray(tracks) || tracks.length === 0 || typeof matcher !== 'function') return -1;
	const matches = [];
	tracks.forEach((track, index) => {
		if (matcher(track, index)) {
			matches.push(index);
		}
	});
	return matches.length === 1 ? matches[0] : -1;
};

const resolveHlsTrackIndex = ({
	hlsTracks,
	mediaTracks,
	selectedTrackIndex,
	allowPositionalFallback = false,
	getLanguage = (track) => track?.lang,
	getTitle = (track) => track?.name
}) => {
	if (!Array.isArray(hlsTracks) || hlsTracks.length === 0) return -1;
	if (!Array.isArray(mediaTracks) || mediaTracks.length === 0) return -1;

	const selectedMediaTrack = mediaTracks.find((track) => track?.Index === selectedTrackIndex);
	if (!selectedMediaTrack) return -1;

	const selectedLanguage = normalizeTrackToken(selectedMediaTrack?.Language);
	const selectedTitle = normalizeTrackToken(selectedMediaTrack?.Title);

	if (selectedLanguage && selectedTitle) {
		const exactMatch = findUniqueTrackMatchIndex(hlsTracks, (track) => (
			normalizeTrackToken(getLanguage(track)) === selectedLanguage &&
			normalizeTrackToken(getTitle(track)) === selectedTitle
		));
		if (exactMatch >= 0) return exactMatch;
	}

	if (selectedTitle) {
		const titleMatch = findUniqueTrackMatchIndex(hlsTracks, (track) => (
			normalizeTrackToken(getTitle(track)) === selectedTitle
		));
		if (titleMatch >= 0) return titleMatch;
	}

	if (selectedLanguage) {
		const languageMatch = findUniqueTrackMatchIndex(hlsTracks, (track) => (
			normalizeTrackToken(getLanguage(track)) === selectedLanguage
		));
		if (languageMatch >= 0) return languageMatch;
	}

	if (allowPositionalFallback) {
		// Last resort for manifests that omit language/title metadata.
		const mediaTrackOrder = mediaTracks.findIndex((track) => track?.Index === selectedTrackIndex);
		if (mediaTrackOrder >= 0 && mediaTrackOrder < hlsTracks.length) {
			return mediaTrackOrder;
		}
	}

	return -1;
};

export const usePlayerSeekAndTrackSwitching = ({
	item,
	videoRef,
	hlsRef,
	duration,
	isCurrentTranscoding,
	mediaSourceData,
	checkSkipSegments,
	playbackOptions,
	playbackSettingsRef,
	currentAudioTrack,
	currentSubtitleTrack,
	getPlaybackSessionContext,
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
	setToastMessage
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
			const seekTicks = Math.floor(seekTime * JELLYFIN_TICKS_PER_SECOND);
			await jellyfinService.reportPlaybackProgress(
				item.Id,
				seekTicks,
				videoRef.current.paused,
				getPlaybackSessionContext()
			);
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
		getPlaybackSessionContext,
		handleStop,
		isCurrentTranscoding,
		item?.Id,
		lastInteractionRef,
		loadVideo,
		mediaSourceData,
		playbackOptions,
		playbackOverrideRef,
		setCurrentTime,
		setLoading,
		videoRef
	]);

	const reloadWithTrackSelection = useCallback(async (audioIndex, subtitleIndex) => {
		if (!videoRef.current) return;
		const currentPosition = videoRef.current.currentTime || 0;
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: audioIndex,
			subtitleStreamIndex: subtitleIndex,
			seekSeconds: currentPosition
		});
		setLoading(true);
		await handleStop();
		loadVideo();
	}, [handleStop, loadVideo, mediaSourceData?.Id, playbackOptions, playbackOverrideRef, setLoading, videoRef]);

	const shouldForceSubtitleReload = useCallback((trackIndex) => {
		if (!(Number.isInteger(trackIndex) && trackIndex >= 0)) return false;
		const settings = playbackSettingsRef?.current || {};
		return shouldTranscodeForSubtitleSelection(mediaSourceData, trackIndex, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
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
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs
		});
		return policy.clientRender === true;
	}, [mediaSourceData, playbackSettingsRef]);

	const handleAudioTrackChange = useCallback(async (trackIndex) => {
		setCurrentAudioTrack(trackIndex);
		closeAudioPopup();
		saveAudioSelection(trackIndex, audioTracks);

		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			const hlsTrackIndex = resolveHlsTrackIndex({
				hlsTracks: hlsRef.current.audioTracks,
				mediaTracks: audioTracks,
				selectedTrackIndex: trackIndex
			});
			if (hlsTrackIndex >= 0) {
				hlsRef.current.audioTrack = hlsTrackIndex;
				return;
			}
		}
		reloadWithTrackSelection(trackIndex, currentSubtitleTrack);
	}, [
		audioTracks,
		closeAudioPopup,
		currentSubtitleTrack,
		hlsRef,
		reloadWithTrackSelection,
		saveAudioSelection,
		setCurrentAudioTrack
	]);

	const handleSubtitleTrackChange = useCallback(async (trackIndex) => {
		setCurrentSubtitleTrack(trackIndex);
		closeSubtitlePopup();
		saveSubtitleSelection(trackIndex, subtitleTracks);

		if (shouldForceSubtitleReload(trackIndex)) {
			setToastMessage('Subtitle burn-in requires stream reload.');
			reloadWithTrackSelection(currentAudioTrack, trackIndex);
			return;
		}

		if (shouldUseClientSubtitleRenderer(trackIndex)) {
			setToastMessage('Rendering subtitles in app.');
			return;
		}

		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hlsTrackIndex = resolveHlsTrackIndex({
					hlsTracks: hlsRef.current.subtitleTracks,
					mediaTracks: subtitleTracks,
					selectedTrackIndex: trackIndex
				});
				if (hlsTrackIndex >= 0) {
					hlsRef.current.subtitleTrack = hlsTrackIndex;
					return;
				}
			}
			setToastMessage('Subtitle change may require retry/reload on this stream');
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
