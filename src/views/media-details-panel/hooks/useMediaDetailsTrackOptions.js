import {useMemo} from 'react';
import {getTrackSummaryLabel, toLanguageDisplayName} from '../utils/mediaDetailsHelpers';

export const useMediaDetailsTrackOptions = ({
	playbackInfo,
	selectedAudioTrack,
	selectedSubtitleTrack
}) => {
	const audioTracks = useMemo(() => (
		playbackInfo?.MediaSources?.[0]?.MediaStreams
			.filter((stream) => stream.Type === 'Audio')
			.map((track) => ({
				children: `${toLanguageDisplayName(track.Language)} - ${track.DisplayTitle || track.Codec}`,
				summary: toLanguageDisplayName(track.Language),
				key: track.Index
			})) || []
	), [playbackInfo]);

	const subtitleTracks = useMemo(() => ([
		{children: 'None', summary: 'None', key: -1},
		...(playbackInfo?.MediaSources?.[0]?.MediaStreams
			.filter((stream) => stream.Type === 'Subtitle')
			.map((track) => ({
				children: `${toLanguageDisplayName(track.Language)} - ${track.DisplayTitle || 'Subtitle'}`,
				summary: toLanguageDisplayName(track.Language),
				key: track.Index
			})) || [])
	]), [playbackInfo]);

	const audioSummary = useMemo(() => {
		return getTrackSummaryLabel(audioTracks, selectedAudioTrack, {
			defaultLabel: 'Default'
		});
	}, [audioTracks, selectedAudioTrack]);

	const subtitleSummary = useMemo(() => {
		return getTrackSummaryLabel(subtitleTracks, selectedSubtitleTrack, {
			noneKey: -1,
			noneLabel: 'None',
			defaultLabel: 'Default'
		});
	}, [selectedSubtitleTrack, subtitleTracks]);

	return {
		audioTracks,
		subtitleTracks,
		audioSummary,
		subtitleSummary
	};
};
