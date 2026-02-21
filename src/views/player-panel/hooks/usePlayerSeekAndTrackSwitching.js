import {useCallback} from 'react';
import jellyfinService from '../../../services/jellyfinService';

export const usePlayerSeekAndTrackSwitching = ({
	item,
	videoRef,
	hlsRef,
	duration,
	isCurrentTranscoding,
	mediaSourceData,
	checkSkipSegments,
	playbackOptions,
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
			const seekTicks = Math.floor(seekTime * 10000000);
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
				const seekTicks = Math.floor(seekTime * 10000000);
				setLoading(true);
				playbackOverrideRef.current = {
					...(playbackOptions || {}),
					audioStreamIndex: Number.isInteger(currentAudioTrack) ? currentAudioTrack : undefined,
					subtitleStreamIndex: currentSubtitleTrack >= 0 ? currentSubtitleTrack : undefined,
					startTimeTicks: seekTicks,
					seekSeconds: seekTime,
					forceNewSession: true
				};
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
		playbackOverrideRef.current = {
			...(playbackOptions || {}),
			audioStreamIndex: Number.isInteger(audioIndex) ? audioIndex : undefined,
			subtitleStreamIndex: (subtitleIndex === -1 || Number.isInteger(subtitleIndex)) ? subtitleIndex : undefined,
			seekSeconds: currentPosition,
			forceNewSession: true
		};
		setLoading(true);
		await handleStop();
		loadVideo();
	}, [handleStop, loadVideo, playbackOptions, playbackOverrideRef, setLoading, videoRef]);

	const handleAudioTrackChange = useCallback(async (trackIndex) => {
		setCurrentAudioTrack(trackIndex);
		closeAudioPopup();
		saveAudioSelection(trackIndex, audioTracks);

		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			const hlsTrackIndex = hlsRef.current.audioTracks.findIndex((track) => {
				const mediaTrack = audioTracks.find((audioTrack) => audioTrack.Index === trackIndex);
				return track.lang === mediaTrack?.Language || track.name === mediaTrack?.Title;
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

		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hlsTrackIndex = hlsRef.current.subtitleTracks.findIndex((track) => {
					const mediaTrack = subtitleTracks.find((subtitleTrack) => subtitleTrack.Index === trackIndex);
					return mediaTrack && (track.lang === mediaTrack.Language || track.name === mediaTrack.Title);
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
