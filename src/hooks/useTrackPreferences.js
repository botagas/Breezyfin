import {useRef, useCallback} from 'react';
import {
	readTrackPreferences,
	writeTrackPreferences,
	createAudioPreference,
	createSubtitlePreference
} from '../utils/trackPreferences';
import {isSupportedAudioCodec} from '../services/jellyfin/playbackSelection';

const isInteger = (value) => Number.isInteger(value);

const matchesLanguage = (stream, language) =>
	Boolean(stream?.Language) &&
	Boolean(language) &&
	String(stream.Language).toLowerCase() === String(language).toLowerCase();

const isCompatibleAudioStream = (stream) => isSupportedAudioCodec(stream?.Codec);

const pickBestCompatibleAudioTrack = (audioStreams = []) => {
	if (!Array.isArray(audioStreams) || audioStreams.length === 0) return null;
	const preferredCodecs = ['eac3', 'ec3', 'ac3', 'aac', 'mp3', 'mp2'];
	const normalizedCodec = (value) => String(value || '').trim().toLowerCase();
	let best = null;
	audioStreams.forEach((stream, order) => {
		if (!isCompatibleAudioStream(stream)) return;
		const index = stream?.Index;
		if (!isInteger(index)) return;
		const codec = normalizedCodec(stream?.Codec);
		const codecPriority = preferredCodecs.indexOf(codec);
		const priorityScore = codecPriority >= 0 ? (preferredCodecs.length - codecPriority) : 1;
		const channels = Number.isFinite(stream?.Channels) ? Number(stream.Channels) : 0;
		const score = priorityScore * 100 + channels;
		if (!best || score > best.score || (score === best.score && order < best.order)) {
			best = {index, score, order};
		}
	});
	return best?.index ?? null;
};

export const useTrackPreferences = () => {
	const preferencesRef = useRef(readTrackPreferences() || {});

	const loadTrackPreferences = useCallback(() => {
		preferencesRef.current = readTrackPreferences() || {};
		return preferencesRef.current;
	}, []);

	const saveTrackPreferences = useCallback((preferences) => {
		const normalized = preferences && typeof preferences === 'object' ? preferences : {};
		preferencesRef.current = normalized;
		writeTrackPreferences(normalized);
		return normalized;
	}, []);

	const pickPreferredAudio = useCallback((audioStreams = [], providedAudio = null, defaultAudio = null) => {
		if (!audioStreams.length) return null;
		const preference = preferencesRef.current?.audio;
		if (isInteger(providedAudio) && audioStreams.some((stream) => stream.Index === providedAudio)) {
			return providedAudio;
		}
		if (
			isInteger(preference?.index) &&
			audioStreams.some((stream) => stream.Index === preference.index && isCompatibleAudioStream(stream))
		) {
			return preference.index;
		}
		if (preference?.language) {
			const languageMatch = audioStreams.find(
				(stream) => matchesLanguage(stream, preference.language) && isCompatibleAudioStream(stream)
			);
			if (languageMatch) return languageMatch.Index;
		}
		if (isCompatibleAudioStream(defaultAudio)) {
			return defaultAudio?.Index ?? null;
		}
		const compatibleFallback = pickBestCompatibleAudioTrack(audioStreams);
		if (isInteger(compatibleFallback)) {
			return compatibleFallback;
		}
		return defaultAudio?.Index ?? audioStreams[0]?.Index ?? null;
	}, []);

	const pickPreferredSubtitle = useCallback((subtitleStreams = [], providedSubtitle = null, defaultSubtitle = null) => {
		if (providedSubtitle === -1) return -1;
		if (isInteger(providedSubtitle) && subtitleStreams.some((stream) => stream.Index === providedSubtitle)) {
			return providedSubtitle;
		}

		const preference = preferencesRef.current?.subtitle;
		if (preference?.off) return -1;
		if (isInteger(preference?.index) && subtitleStreams.some((stream) => stream.Index === preference.index)) {
			return preference.index;
		}

		if (preference?.language) {
			const nonForced = subtitleStreams.find((stream) => matchesLanguage(stream, preference.language) && !stream.IsForced);
			if (nonForced) return nonForced.Index;
			const languageMatch = subtitleStreams.find((stream) => matchesLanguage(stream, preference.language));
			if (languageMatch) return languageMatch.Index;
		}

		if (defaultSubtitle?.IsForced) {
			const sameLanguageNonForced = subtitleStreams.find(
				(stream) => !stream.IsForced && matchesLanguage(stream, defaultSubtitle.Language)
			);
			if (sameLanguageNonForced) return sameLanguageNonForced.Index;
			const anyNonForced = subtitleStreams.find((stream) => !stream.IsForced);
			if (anyNonForced) return anyNonForced.Index;
		}

		return -1;
	}, []);

	const resolveDefaultTrackSelection = useCallback((mediaStreams = [], options = {}) => {
		if (!Array.isArray(mediaStreams) || mediaStreams.length === 0) {
			return {
				selectedAudioTrack: null,
				selectedSubtitleTrack: -1
			};
		}

		const audioStreams = mediaStreams.filter((stream) => stream.Type === 'Audio');
		const subtitleStreams = mediaStreams.filter((stream) => stream.Type === 'Subtitle');
		const defaultAudio = options.defaultAudio || mediaStreams.find((stream) => stream.Type === 'Audio' && stream.IsDefault) || audioStreams[0];
		const defaultSubtitle = options.defaultSubtitle || subtitleStreams.find((stream) => stream.IsDefault);

		const selectedAudioTrack = pickPreferredAudio(audioStreams, options.providedAudio ?? null, defaultAudio);
		const selectedSubtitleRaw = pickPreferredSubtitle(subtitleStreams, options.providedSubtitle ?? null, defaultSubtitle);
		const selectedSubtitleTrack = selectedSubtitleRaw === null || selectedSubtitleRaw === undefined ? -1 : selectedSubtitleRaw;

		return {
			selectedAudioTrack,
			selectedSubtitleTrack
		};
	}, [pickPreferredAudio, pickPreferredSubtitle]);

	const saveAudioSelection = useCallback((trackIndex, audioStreams = []) => {
		const selectedStream = audioStreams.find((stream) => stream.Index === trackIndex);
		return saveTrackPreferences({
			...(preferencesRef.current || {}),
			audio: createAudioPreference(trackIndex, selectedStream),
			subtitle: preferencesRef.current?.subtitle
		});
	}, [saveTrackPreferences]);

	const saveSubtitleSelection = useCallback((trackIndex, subtitleStreams = []) => {
		const selectedStream = subtitleStreams.find((stream) => stream.Index === trackIndex);
		return saveTrackPreferences({
			...(preferencesRef.current || {}),
			subtitle: createSubtitlePreference(trackIndex, selectedStream),
			audio: preferencesRef.current?.audio
		});
	}, [saveTrackPreferences]);

	return {
		preferencesRef,
		loadTrackPreferences,
		saveTrackPreferences,
		pickPreferredAudio,
		pickPreferredSubtitle,
		resolveDefaultTrackSelection,
		saveAudioSelection,
		saveSubtitleSelection
	};
};
