export const normalizeTrackToken = (value) => String(value || '').trim().toLowerCase();

const toInteger = (value) => (Number.isInteger(value) ? value : null);

const normalizeChannels = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

export const getTrackTitle = (track) => (
	track?.DisplayTitle ||
	track?.Title ||
	track?.Name ||
	track?.label ||
	track?.name ||
	''
);

export const getTrackLanguage = (track) => (
	track?.Language ||
	track?.language ||
	track?.lang ||
	''
);

export const getLanguageOrdinal = (tracks = [], selectedTrack = null) => {
	if (!selectedTrack) return null;
	const selectedIndex = toInteger(selectedTrack.Index);
	const selectedLanguage = normalizeTrackToken(getTrackLanguage(selectedTrack));
	if (!selectedLanguage || selectedIndex === null) return null;
	let ordinal = 0;
	for (const track of tracks || []) {
		if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) continue;
		if (toInteger(track?.Index) === selectedIndex) return ordinal;
		ordinal += 1;
	}
	return null;
};

export const createAudioTrackIdentity = (track, tracks = []) => ({
	index: track?.Index,
	language: track?.Language || null,
	title: track?.Title || null,
	displayTitle: track?.DisplayTitle || null,
	codec: track?.Codec || null,
	channels: normalizeChannels(track?.Channels),
	isDefault: Boolean(track?.IsDefault),
	languageOrdinal: getLanguageOrdinal(tracks, track)
});

const getTrackCodec = (track) => track?.Codec || track?.codec || '';

const getTrackForced = (track) => (
	typeof track?.IsForced === 'boolean' ? track.IsForced : null
);

const getTrackDefault = (track) => (
	typeof track?.IsDefault === 'boolean' ? track.IsDefault : null
);

const getLanguageCodecOrdinal = (tracks = [], selectedTrack = null) => {
	if (!selectedTrack) return null;
	const selectedIndex = toInteger(selectedTrack.Index);
	const selectedLanguage = normalizeTrackToken(getTrackLanguage(selectedTrack));
	const selectedCodec = normalizeTrackToken(getTrackCodec(selectedTrack));
	if (!selectedLanguage || !selectedCodec || selectedIndex === null) return null;
	let ordinal = 0;
	for (const track of tracks || []) {
		if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) continue;
		if (normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) continue;
		if (toInteger(track?.Index) === selectedIndex) return ordinal;
		ordinal += 1;
	}
	return null;
};

export const createSubtitleTrackIdentity = (track, tracks = []) => ({
	off: false,
	index: track?.Index,
	language: track?.Language || null,
	title: track?.Title || null,
	displayTitle: track?.DisplayTitle || null,
	codec: track?.Codec || null,
	isForced: Boolean(track?.IsForced),
	isDefault: Boolean(track?.IsDefault),
	languageOrdinal: getLanguageOrdinal(tracks, track),
	languageCodecOrdinal: getLanguageCodecOrdinal(tracks, track)
});

const findUniqueMediaTrackIndex = (mediaTracks, matcher) => {
	const matches = [];
	mediaTracks.forEach((track) => {
		if (matcher(track)) matches.push(track?.Index);
	});
	return matches.length === 1 ? matches[0] : null;
};

const findSameLanguageOrdinalMediaTrack = ({
	mediaTracks,
	selectedLanguage,
	selectedOrdinal
}) => {
	if (!selectedLanguage || selectedOrdinal === null) return null;
	let ordinal = 0;
	for (const track of mediaTracks || []) {
		if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) continue;
		if (ordinal === selectedOrdinal) return track?.Index ?? null;
		ordinal += 1;
	}
	return null;
};

const findSameLanguageCodecOrdinalMediaTrack = ({
	mediaTracks,
	selectedLanguage,
	selectedCodec,
	selectedOrdinal
}) => {
	if (!selectedLanguage || !selectedCodec || selectedOrdinal === null) return null;
	let ordinal = 0;
	for (const track of mediaTracks || []) {
		if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) continue;
		if (normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) continue;
		if (ordinal === selectedOrdinal) return track?.Index ?? null;
		ordinal += 1;
	}
	return null;
};

export const resolveAudioTrackIndex = ({
	audioStreams = [],
	intent = null,
	fallbackIndex = null
} = {}) => {
	if (!Array.isArray(audioStreams) || audioStreams.length === 0) {
		return {index: null, method: 'audio-empty'};
	}
	if (!intent || typeof intent !== 'object') {
		return {index: fallbackIndex, method: 'no-intent'};
	}

	const selectedLanguage = normalizeTrackToken(intent.language);
	const selectedTitle = normalizeTrackToken(intent.displayTitle || intent.title);
	const selectedCodec = normalizeTrackToken(intent.codec);
	const selectedChannels = normalizeChannels(intent.channels);
	const selectedDefault = intent.isDefault === true ? true : null;

	if (selectedTitle) {
		const titleMatch = findUniqueMediaTrackIndex(audioStreams, (track) => {
			if (normalizeTrackToken(getTrackTitle(track)) !== selectedTitle) return false;
			if (selectedLanguage && normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) return false;
			if (selectedCodec && normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) return false;
			if (selectedChannels !== null && normalizeChannels(track?.Channels) !== selectedChannels) return false;
			return true;
		});
		if (titleMatch !== null) return {index: titleMatch, method: 'title-details'};
	}

	if (selectedLanguage && (selectedCodec || selectedChannels !== null)) {
		const detailsMatch = findUniqueMediaTrackIndex(audioStreams, (track) => {
			if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) return false;
			if (selectedCodec && normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) return false;
			if (selectedChannels !== null && normalizeChannels(track?.Channels) !== selectedChannels) return false;
			if (selectedDefault !== null && getTrackDefault(track) !== selectedDefault) return false;
			return true;
		});
		if (detailsMatch !== null) return {index: detailsMatch, method: 'language-details'};
	}

	const ordinalMatch = findSameLanguageOrdinalMediaTrack({
		mediaTracks: audioStreams,
		selectedLanguage,
		selectedOrdinal: Number.isInteger(intent.languageOrdinal) ? intent.languageOrdinal : null
	});
	if (ordinalMatch !== null) return {index: ordinalMatch, method: 'language-ordinal'};

	if (toInteger(intent.index) !== null) {
		const sameIndex = audioStreams.find((track) => track?.Index === intent.index);
		if (
			sameIndex &&
			(!selectedLanguage || normalizeTrackToken(getTrackLanguage(sameIndex)) === selectedLanguage) &&
			(!selectedCodec || normalizeTrackToken(getTrackCodec(sameIndex)) === selectedCodec)
		) {
			return {index: intent.index, method: 'same-index-compatible'};
		}
	}

	return {index: fallbackIndex, method: 'no-match'};
};

export const resolveSubtitleTrackIndex = ({
	subtitleStreams = [],
	intent = null,
	fallbackIndex = null
} = {}) => {
	if (intent?.off === true) {
		return {index: -1, method: 'intent-off'};
	}
	if (!Array.isArray(subtitleStreams) || subtitleStreams.length === 0) {
		return {index: -1, method: 'subtitle-empty'};
	}
	if (!intent || typeof intent !== 'object') {
		return {index: fallbackIndex, method: 'no-intent'};
	}

	const selectedLanguage = normalizeTrackToken(intent.language);
	const selectedTitle = normalizeTrackToken(intent.displayTitle || intent.title);
	const selectedCodec = normalizeTrackToken(intent.codec);
	const selectedForced = typeof intent.isForced === 'boolean' ? intent.isForced : null;
	const selectedDefault = typeof intent.isDefault === 'boolean' ? intent.isDefault : null;

	if (selectedTitle) {
		const titleMatch = findUniqueMediaTrackIndex(subtitleStreams, (track) => {
			if (normalizeTrackToken(getTrackTitle(track)) !== selectedTitle) return false;
			if (selectedLanguage && normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) return false;
			if (selectedCodec && normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) return false;
			if (selectedForced !== null && getTrackForced(track) !== selectedForced) return false;
			if (selectedDefault !== null && getTrackDefault(track) !== selectedDefault) return false;
			return true;
		});
		if (titleMatch !== null) return {index: titleMatch, method: 'title-details'};
	}

	if (selectedLanguage && selectedTitle) {
		const languageTitleMatch = findUniqueMediaTrackIndex(subtitleStreams, (track) => (
			normalizeTrackToken(getTrackLanguage(track)) === selectedLanguage &&
			normalizeTrackToken(getTrackTitle(track)) === selectedTitle
		));
		if (languageTitleMatch !== null) return {index: languageTitleMatch, method: 'language-title'};
	}

	if (selectedLanguage && selectedCodec) {
		const languageDetailsMatch = findUniqueMediaTrackIndex(subtitleStreams, (track) => {
			if (normalizeTrackToken(getTrackLanguage(track)) !== selectedLanguage) return false;
			if (normalizeTrackToken(getTrackCodec(track)) !== selectedCodec) return false;
			if (selectedForced !== null && getTrackForced(track) !== selectedForced) return false;
			if (selectedDefault !== null && getTrackDefault(track) !== selectedDefault) return false;
			return true;
		});
		if (languageDetailsMatch !== null) return {index: languageDetailsMatch, method: 'language-codec-state'};
	}

	const languageCodecOrdinalMatch = findSameLanguageCodecOrdinalMediaTrack({
		mediaTracks: subtitleStreams,
		selectedLanguage,
		selectedCodec,
		selectedOrdinal: Number.isInteger(intent.languageCodecOrdinal) ? intent.languageCodecOrdinal : null
	});
	if (languageCodecOrdinalMatch !== null) {
		return {index: languageCodecOrdinalMatch, method: 'language-codec-ordinal'};
	}

	const languageOrdinalMatch = findSameLanguageOrdinalMediaTrack({
		mediaTracks: subtitleStreams,
		selectedLanguage,
		selectedOrdinal: Number.isInteger(intent.languageOrdinal) ? intent.languageOrdinal : null
	});
	if (languageOrdinalMatch !== null) {
		return {index: languageOrdinalMatch, method: 'language-ordinal'};
	}

	if (toInteger(intent.index) !== null) {
		const sameIndex = subtitleStreams.find((track) => track?.Index === intent.index);
		if (
			sameIndex &&
			(!selectedLanguage || normalizeTrackToken(getTrackLanguage(sameIndex)) === selectedLanguage) &&
			(!selectedCodec || normalizeTrackToken(getTrackCodec(sameIndex)) === selectedCodec)
		) {
			return {index: intent.index, method: 'same-index-compatible'};
		}
	}

	return {index: fallbackIndex, method: 'no-match'};
};

const getRuntimeTrackMetadata = ({
	track,
	getLanguage,
	getTitle,
	getCodec,
	getChannels
}) => ({
	language: normalizeTrackToken(getLanguage(track)),
	title: normalizeTrackToken(getTitle(track)),
	codec: normalizeTrackToken(getCodec(track)),
	channels: normalizeChannels(getChannels(track))
});

const findUniqueRuntimeTrackIndex = (runtimeTracks, matcher) => {
	const matches = [];
	runtimeTracks.forEach((track, index) => {
		if (matcher(track, index)) matches.push(index);
	});
	return matches.length === 1 ? matches[0] : -1;
};

const getSameLanguageOrdinalIndex = ({
	runtimeTracks,
	selectedLanguage,
	selectedOrdinal,
	getLanguage
}) => {
	if (!selectedLanguage || selectedOrdinal === null) return -1;
	let ordinal = 0;
	for (let index = 0; index < runtimeTracks.length; index += 1) {
		if (normalizeTrackToken(getLanguage(runtimeTracks[index])) !== selectedLanguage) continue;
		if (ordinal === selectedOrdinal) return index;
		ordinal += 1;
	}
	return -1;
};

export const resolveRuntimeTrackIndex = ({
	runtimeTracks,
	mediaTracks,
	selectedTrackIndex,
	allowPositionalFallback = false,
	getLanguage = (track) => track?.lang || track?.language,
	getTitle = (track) => track?.name || track?.label,
	getCodec = (track) => track?.codec,
	getChannels = (track) => track?.channels
} = {}) => {
	if (!Array.isArray(runtimeTracks) || runtimeTracks.length === 0) {
		return {index: -1, method: 'runtime-empty'};
	}
	if (!Array.isArray(mediaTracks) || mediaTracks.length === 0) {
		return {index: -1, method: 'media-empty'};
	}

	const selectedMediaTrack = mediaTracks.find((track) => track?.Index === selectedTrackIndex);
	if (!selectedMediaTrack) return {index: -1, method: 'selected-missing'};

	const selectedLanguage = normalizeTrackToken(getTrackLanguage(selectedMediaTrack));
	const selectedTitle = normalizeTrackToken(getTrackTitle(selectedMediaTrack));
	const selectedCodec = normalizeTrackToken(selectedMediaTrack?.Codec);
	const selectedChannels = normalizeChannels(selectedMediaTrack?.Channels);
	const selectedOrdinal = getLanguageOrdinal(mediaTracks, selectedMediaTrack);

	if (selectedTitle) {
		const titleMatch = findUniqueRuntimeTrackIndex(runtimeTracks, (track) => (
			getRuntimeTrackMetadata({track, getLanguage, getTitle, getCodec, getChannels}).title === selectedTitle
		));
		if (titleMatch >= 0) return {index: titleMatch, method: 'title'};
	}

	if (selectedLanguage && selectedTitle) {
		const languageTitleMatch = findUniqueRuntimeTrackIndex(runtimeTracks, (track) => {
			const metadata = getRuntimeTrackMetadata({track, getLanguage, getTitle, getCodec, getChannels});
			return metadata.language === selectedLanguage && metadata.title === selectedTitle;
		});
		if (languageTitleMatch >= 0) return {index: languageTitleMatch, method: 'language-title'};
	}

	if (selectedLanguage && (selectedCodec || selectedChannels !== null)) {
		const languageDetailsMatch = findUniqueRuntimeTrackIndex(runtimeTracks, (track) => {
			const metadata = getRuntimeTrackMetadata({track, getLanguage, getTitle, getCodec, getChannels});
			if (metadata.language !== selectedLanguage) return false;
			if (selectedCodec && metadata.codec && metadata.codec !== selectedCodec) return false;
			if (selectedChannels !== null && metadata.channels !== null && metadata.channels !== selectedChannels) return false;
			return true;
		});
		if (languageDetailsMatch >= 0) return {index: languageDetailsMatch, method: 'language-details'};
	}

	const ordinalMatch = getSameLanguageOrdinalIndex({
		runtimeTracks,
		selectedLanguage,
		selectedOrdinal,
		getLanguage
	});
	if (ordinalMatch >= 0) return {index: ordinalMatch, method: 'same-language-ordinal'};

	if (allowPositionalFallback && runtimeTracks.length === mediaTracks.length) {
		const mediaTrackOrder = mediaTracks.findIndex((track) => track?.Index === selectedTrackIndex);
		if (mediaTrackOrder >= 0 && mediaTrackOrder < runtimeTracks.length) {
			return {index: mediaTrackOrder, method: 'position'};
		}
	}

	return {index: -1, method: 'no-match'};
};

export const snapshotNativeAudioTracks = (video) => {
	const nativeTracks = video?.audioTracks;
	if (!nativeTracks || typeof nativeTracks.length !== 'number') return [];
	return Array.from({length: nativeTracks.length}, (_, index) => {
		const track = nativeTracks[index];
		return {
			index,
			id: track?.id || '',
			label: track?.label || '',
			language: track?.language || '',
			codec: track?.codec || '',
			channels: track?.channels || null,
			kind: track?.kind || '',
			enabled: track?.enabled === true
		};
	});
};

export const applyNativeAudioTrackSelection = ({
	video,
	mediaTracks,
	selectedTrackIndex
} = {}) => {
	const nativeTracks = video?.audioTracks;
	const snapshot = snapshotNativeAudioTracks(video);
	if (!nativeTracks || typeof nativeTracks.length !== 'number' || nativeTracks.length === 0) {
		return {applied: false, status: 'native-unavailable', index: -1, method: 'runtime-empty', tracks: snapshot};
	}
	const resolved = resolveRuntimeTrackIndex({
		runtimeTracks: snapshot,
		mediaTracks,
		selectedTrackIndex,
		allowPositionalFallback: true,
		getLanguage: (track) => track?.language,
		getTitle: (track) => track?.label
	});
	if (resolved.index < 0) {
		return {applied: false, status: 'native-no-match', index: -1, method: resolved.method, tracks: snapshot};
	}
	try {
		for (let index = 0; index < nativeTracks.length; index += 1) {
			nativeTracks[index].enabled = index === resolved.index;
		}
		const appliedSnapshot = snapshotNativeAudioTracks(video);
		const applied = appliedSnapshot[resolved.index]?.enabled === true;
		return {
			applied,
			status: applied ? 'native-applied' : 'native-failed',
			index: resolved.index,
			method: resolved.method,
			tracks: appliedSnapshot
		};
	} catch (error) {
		return {
			applied: false,
			status: 'native-error',
			index: resolved.index,
			method: resolved.method,
			error: error?.message || 'native-audio-switch-failed',
			tracks: snapshotNativeAudioTracks(video)
		};
	}
};
