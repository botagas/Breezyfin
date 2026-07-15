import {useCallback, useEffect} from 'react';
import {createAudioPreference, createSubtitlePreference} from '../../../utils/trackPreferences';

export const usePlayerPlaybackContext = ({
	playbackSettingsRef,
	playbackSessionRef,
	currentAudioTrack,
	currentSubtitleTrack,
	audioTracks = [],
	subtitleTracks = [],
	currentAudioTrackRef,
	currentSubtitleTrackRef
}) => {
	const buildPlaybackOptions = useCallback(({remapTrackIntents = false} = {}) => {
		const options = {...playbackSettingsRef.current};
		if (Number.isInteger(currentAudioTrack)) {
			const selectedAudio = audioTracks.find((track) => track?.Index === currentAudioTrack);
			options.audioTrackIntent = createAudioPreference(currentAudioTrack, selectedAudio, audioTracks);
			if (!remapTrackIntents) {
				options.audioStreamIndex = currentAudioTrack;
			} else {
				delete options.audioStreamIndex;
			}
		}
		if (currentSubtitleTrack === -1 || Number.isInteger(currentSubtitleTrack)) {
			const selectedSubtitle = subtitleTracks.find((track) => track?.Index === currentSubtitleTrack);
			options.subtitleTrackIntent = createSubtitlePreference(currentSubtitleTrack, selectedSubtitle, subtitleTracks);
			if (!remapTrackIntents || currentSubtitleTrack === -1) {
				options.subtitleStreamIndex = currentSubtitleTrack;
			} else {
				delete options.subtitleStreamIndex;
			}
		}
		return options;
	}, [audioTracks, currentAudioTrack, currentSubtitleTrack, playbackSettingsRef, subtitleTracks]);

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
