import {useCallback} from 'react';
import {useSyncPlay} from '../../../contexts/SyncPlayContext';
import {runSyncPlayQueueAction} from '../utils/syncPlayQueueAction';

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
	setError,
	setToastMessage
}) => {
	const syncPlay = useSyncPlay();
	const syncPlayFollowing = Boolean(syncPlay.group && syncPlay.followMode === 'following');
	const syncPlayNext = syncPlayFollowing ? syncPlay.next : null;
	const syncPlayPrevious = syncPlayFollowing ? syncPlay.previous : null;
	const handlePlayNextEpisode = useCallback(async () => {
		if (await runSyncPlayQueueAction({
			action: syncPlayNext,
			logMessage: 'Failed to advance the SyncPlay queue:',
			toastMessage: 'SyncPlay could not advance to the next item.',
			setToastMessage
		})) return;
		if (!item || item.Type !== 'Episode' || !onPlay || !hasNextEpisode) return;
		try {
			const nextEpisode = nextEpisodeData || await getNextEpisode(item);
			if (nextEpisode) {
				const opts = buildPlaybackOptions({remapTrackIntents: true});
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
		playbackOverrideRef,
		setToastMessage,
		syncPlayNext
	]);

	const handlePlayPreviousEpisode = useCallback(async () => {
		if (await runSyncPlayQueueAction({
			action: syncPlayPrevious,
			logMessage: 'Failed to move back in the SyncPlay queue:',
			toastMessage: 'SyncPlay could not return to the previous item.',
			setToastMessage
		})) return;
		if (!item || item.Type !== 'Episode' || !onPlay || !hasPreviousEpisode) return;
		try {
			const previousEpisode = await getPreviousEpisode(item);
			if (previousEpisode) {
				const opts = buildPlaybackOptions({remapTrackIntents: true});
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
		playbackOverrideRef,
		setToastMessage,
		syncPlayPrevious
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

	const clearError = useCallback(() => {
		setError(null);
	}, [setError]);

	return {
		handlePlayNextEpisode,
		handlePlayPreviousEpisode,
		handleVideoSurfaceClick,
		handleVolumeChange,
		toggleMute,
		clearError
	};
};
