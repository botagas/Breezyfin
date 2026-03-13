import {useCallback} from 'react';

export const usePlayerEpisodeAndSurfaceHandlers = ({
	item,
	onPlay,
	hasNextEpisode,
	nextEpisodeData,
	getNextEpisode,
	hasPreviousEpisode,
	getPreviousEpisode,
	buildPlaybackOptions,
	playbackOverrideRef,
	handleStop,
	loading,
	error,
	showAudioPopup,
	showSubtitlePopup,
	showControls,
	playing,
	handlePause,
	handlePlay,
	lastInteractionRef,
	videoRef,
	muted,
	setMuted,
	setVolume,
	setPlaying,
	setError
}) => {
	const handlePlayNextEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasNextEpisode) return;
		try {
			const nextEpisode = nextEpisodeData || await getNextEpisode(item);
			if (nextEpisode) {
				const opts = buildPlaybackOptions();
				playbackOverrideRef.current = { ...opts, forceNewSession: true };
				await handleStop();
				onPlay(nextEpisode, opts);
			}
		} catch (err) {
			console.error('Failed to play next episode:', err);
		}
	}, [
		buildPlaybackOptions,
		getNextEpisode,
		handleStop,
		hasNextEpisode,
		item,
		nextEpisodeData,
		onPlay,
		playbackOverrideRef
	]);

	const handlePlayPreviousEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasPreviousEpisode) return;
		try {
			const previousEpisode = await getPreviousEpisode(item);
			if (previousEpisode) {
				const opts = buildPlaybackOptions();
				playbackOverrideRef.current = { ...opts, forceNewSession: true };
				await handleStop();
				onPlay(previousEpisode, opts);
			}
		} catch (err) {
			console.error('Failed to play previous episode:', err);
		}
	}, [
		buildPlaybackOptions,
		getPreviousEpisode,
		handleStop,
		hasPreviousEpisode,
		item,
		onPlay,
		playbackOverrideRef
	]);

	const handleVideoSurfaceClick = useCallback(() => {
		if (loading || error || showAudioPopup || showSubtitlePopup) return;
		lastInteractionRef.current = Date.now();
		const keepHidden = !showControls;
		if (playing) {
			handlePause({keepHidden});
		} else {
			handlePlay({keepHidden});
		}
	}, [
		error,
		handlePause,
		handlePlay,
		lastInteractionRef,
		loading,
		playing,
		showAudioPopup,
		showControls,
		showSubtitlePopup
	]);

	const handleVolumeChange = useCallback((event) => {
		lastInteractionRef.current = Date.now();
		if (!videoRef.current) return;
		const newVolume = event.value;
		videoRef.current.volume = newVolume / 100;
		setVolume(newVolume);
		if (newVolume > 0) {
			setMuted(false);
		}
	}, [lastInteractionRef, setMuted, setVolume, videoRef]);

	const toggleMute = useCallback(() => {
		lastInteractionRef.current = Date.now();
		if (!videoRef.current) return;
		const newMuted = !muted;
		videoRef.current.muted = newMuted;
		setMuted(newMuted);
	}, [lastInteractionRef, muted, setMuted, videoRef]);

	const handleVideoPlaying = useCallback(() => {
		setPlaying(true);
	}, [setPlaying]);

	const handleVideoPause = useCallback(() => {
		setPlaying(false);
	}, [setPlaying]);

	const clearError = useCallback(() => {
		setError(null);
	}, [setError]);

	return {
		handlePlayNextEpisode,
		handlePlayPreviousEpisode,
		handleVideoSurfaceClick,
		handleVolumeChange,
		toggleMute,
		handleVideoPlaying,
		handleVideoPause,
		clearError
	};
};
