import {useCallback, useEffect} from 'react';

export const usePlayerPlaybackContext = ({
	playbackSettingsRef,
	playbackSessionRef,
	currentAudioTrack,
	currentSubtitleTrack,
	currentAudioTrackRef,
	currentSubtitleTrackRef
}) => {
	const buildPlaybackOptions = useCallback(() => {
		const options = {...playbackSettingsRef.current};
		if (Number.isInteger(currentAudioTrack)) {
			options.audioStreamIndex = currentAudioTrack;
		}
		if (currentSubtitleTrack === -1 || Number.isInteger(currentSubtitleTrack)) {
			options.subtitleStreamIndex = currentSubtitleTrack;
		}
		return options;
	}, [currentAudioTrack, currentSubtitleTrack, playbackSettingsRef]);

	useEffect(() => {
		currentAudioTrackRef.current = currentAudioTrack;
	}, [currentAudioTrack, currentAudioTrackRef]);

	useEffect(() => {
		currentSubtitleTrackRef.current = currentSubtitleTrack;
	}, [currentSubtitleTrack, currentSubtitleTrackRef]);

	const getPlaybackSessionContext = useCallback(() => ({
		...playbackSessionRef.current,
		audioStreamIndex: Number.isInteger(currentAudioTrackRef.current)
			? currentAudioTrackRef.current
			: undefined,
		subtitleStreamIndex: (
			currentSubtitleTrackRef.current === -1 ||
			Number.isInteger(currentSubtitleTrackRef.current)
		)
			? currentSubtitleTrackRef.current
			: undefined
	}), [currentAudioTrackRef, currentSubtitleTrackRef, playbackSessionRef]);

	return {
		buildPlaybackOptions,
		getPlaybackSessionContext
	};
};
