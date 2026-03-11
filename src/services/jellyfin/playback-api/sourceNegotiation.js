import {
	findBestCompatibleAudioStreamIndex,
	getAudioStreams,
	getDefaultAudioStreamIndex,
	getMediaSourceDynamicRangeInfo,
	isSupportedAudioCodec,
	reorderMediaSources,
	selectMediaSource,
	toInteger
} from '../playbackSelection';
import {hasNonTranscodingDirectPath, usesMkvContainer} from './dolbyVision';
import {fetchPlaybackInfo} from './network';

export const attemptDirectAudioCompatibilityProbe = async ({
	service,
	itemId,
	activePayload,
	selectedSource,
	options,
	forceTranscoding,
	forceDolbyVision,
	requestedAudioStreamIndex,
	createSourceSelectionOptions
}) => {
	const canAttemptDirectAudioCompatibilityProbe =
		!forceTranscoding &&
		!Number.isInteger(options.audioStreamIndex) &&
		selectedSource?.TranscodingUrl &&
		!selectedSource?.SupportsDirectPlay &&
		!selectedSource?.SupportsDirectStream;

	if (!canAttemptDirectAudioCompatibilityProbe) {
		return null;
	}

	const normalizedPreferredAudioLanguage = String(options.preferredAudioLanguage || '').trim().toLowerCase();
	const currentAudioIndex = Number.isInteger(requestedAudioStreamIndex)
		? requestedAudioStreamIndex
		: getDefaultAudioStreamIndex(selectedSource);
	const currentAudioStream = getAudioStreams(selectedSource)
		.find((stream) => toInteger(stream?.Index) === currentAudioIndex);
	const currentAudioLanguage = String(currentAudioStream?.Language || '').trim().toLowerCase();
	const compatibleAudioProbeIndexes = getAudioStreams(selectedSource)
		.map((stream, order) => ({
			index: toInteger(stream?.Index),
			codec: stream?.Codec,
			language: String(stream?.Language || '').trim().toLowerCase(),
			isDefault: stream?.IsDefault === true,
			order
		}))
		.filter((entry) => Number.isInteger(entry.index) && isSupportedAudioCodec(entry.codec))
		.filter((entry) => entry.index !== currentAudioIndex)
		.sort((left, right) => {
			const leftPreferred = normalizedPreferredAudioLanguage && left.language === normalizedPreferredAudioLanguage;
			const rightPreferred = normalizedPreferredAudioLanguage && right.language === normalizedPreferredAudioLanguage;
			if (leftPreferred !== rightPreferred) return rightPreferred ? 1 : -1;
			const leftCurrent = currentAudioLanguage && left.language === currentAudioLanguage;
			const rightCurrent = currentAudioLanguage && right.language === currentAudioLanguage;
			if (leftCurrent !== rightCurrent) return rightCurrent ? 1 : -1;
			if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
			return left.order - right.order;
		});

	for (const audioProbeCandidate of compatibleAudioProbeIndexes) {
		const audioStreamIndex = audioProbeCandidate.index;
		const directAudioProbePayload = {
			...activePayload,
			MediaSourceId: selectedSource?.Id || activePayload.MediaSourceId,
			AudioStreamIndex: audioStreamIndex,
			EnableDirectPlay: true,
			EnableDirectStream: true,
			EnableTranscoding: false
		};
		try {
			const directAudioProbeData = await fetchPlaybackInfo(service, itemId, directAudioProbePayload);
			if (!directAudioProbeData?.MediaSources?.length) continue;
			const directAudioProbeSelection = selectMediaSource(
				directAudioProbeData.MediaSources,
				createSourceSelectionOptions({preferredMediaSourceId: selectedSource?.Id})
			);
			if (directAudioProbeSelection.index > 0) {
				directAudioProbeData.MediaSources = reorderMediaSources(
					directAudioProbeData.MediaSources,
					directAudioProbeSelection.index
				);
			}
			const directAudioProbeSource = directAudioProbeData.MediaSources[0];
			if (!hasNonTranscodingDirectPath(directAudioProbeSource)) {
				continue;
			}
			if (forceDolbyVision && getMediaSourceDynamicRangeInfo(directAudioProbeSource)?.id !== 'DV') {
				continue;
			}
			return {
				data: directAudioProbeData,
				selectedSource: directAudioProbeSource,
				activePayload: directAudioProbePayload,
				requestedAudioStreamIndex: audioStreamIndex,
				adjustment: {
					type: 'audioDirectPathProbe',
					toast: 'Switched audio track to preserve direct playback.'
				}
			};
		} catch (directAudioProbeError) {
			console.warn('Direct audio compatibility probe failed:', directAudioProbeError);
		}
	}

	return null;
};

export const attemptDolbyVisionMkvCompatibilityRetry = async ({
	service,
	itemId,
	activePayload,
	selectedSource,
	forceTranscoding,
	enableTranscoding,
	runtimeSupportsDolbyVision,
	createSourceSelectionOptions,
	buildPayloadWithoutMkvDirectPlay
}) => {
	const canAttemptDolbyVisionMkvCompatibilityRetry =
		!forceTranscoding &&
		enableTranscoding &&
		runtimeSupportsDolbyVision === true &&
		usesMkvContainer(selectedSource) &&
		getMediaSourceDynamicRangeInfo(selectedSource)?.id === 'HDR10';

	if (!canAttemptDolbyVisionMkvCompatibilityRetry) {
		return null;
	}

	const dvCompatibilityPayload = buildPayloadWithoutMkvDirectPlay(activePayload, selectedSource?.Id || null);
	if (!dvCompatibilityPayload) {
		return null;
	}

	try {
		const dvRetryData = await fetchPlaybackInfo(service, itemId, dvCompatibilityPayload);
		if (!dvRetryData?.MediaSources?.length) {
			return null;
		}
		const dvRetrySelection = selectMediaSource(
			dvRetryData.MediaSources,
			createSourceSelectionOptions({preferredMediaSourceId: selectedSource?.Id})
		);
		if (dvRetrySelection.index > 0) {
			dvRetryData.MediaSources = reorderMediaSources(dvRetryData.MediaSources, dvRetrySelection.index);
		}
		const dvRetrySource = dvRetryData.MediaSources[0];
		const dvRetryRange = getMediaSourceDynamicRangeInfo(dvRetrySource);
		const dvRetryImproved =
			dvRetryRange?.id === 'DV' ||
			(!usesMkvContainer(dvRetrySource) && hasNonTranscodingDirectPath(dvRetrySource));
		if (!dvRetryImproved) {
			return null;
		}
		return {
			data: dvRetryData,
			selectedSource: dvRetrySource,
			activePayload: dvCompatibilityPayload,
			adjustment: {
				type: 'dolbyVisionMkvCompatibility',
				toast: 'Adjusted stream path for Dolby Vision compatibility.'
			}
		};
	} catch (dvRetryError) {
		console.warn('Dolby Vision MKV compatibility retry failed:', dvRetryError);
	}

	return null;
};

export const attemptDefaultAudioFallback = async ({
	service,
	itemId,
	activePayload,
	selectedSource,
	options,
	forceTranscoding,
	createSourceSelectionOptions
}) => {
	if (Number.isInteger(options.audioStreamIndex) || forceTranscoding || !selectedSource) {
		return null;
	}

	const defaultAudioIndex = getDefaultAudioStreamIndex(selectedSource);
	const fallbackAudioIndex = findBestCompatibleAudioStreamIndex(selectedSource);
	if (defaultAudioIndex === null || fallbackAudioIndex === null || defaultAudioIndex === fallbackAudioIndex) {
		return null;
	}

	const defaultAudioStream = getAudioStreams(selectedSource).find((stream) => toInteger(stream.Index) === defaultAudioIndex);
	const defaultCodecSupported = isSupportedAudioCodec(defaultAudioStream?.Codec);
	if (defaultCodecSupported) {
		return null;
	}

	const retryPayload = {
		...activePayload,
		MediaSourceId: selectedSource.Id,
		AudioStreamIndex: fallbackAudioIndex
	};
	const retryData = await fetchPlaybackInfo(service, itemId, retryPayload);
	if (!retryData?.MediaSources?.length) {
		return null;
	}

	const retrySelection = selectMediaSource(
		retryData.MediaSources,
		createSourceSelectionOptions({preferredMediaSourceId: selectedSource.Id})
	);
	if (retrySelection.index > 0) {
		retryData.MediaSources = reorderMediaSources(retryData.MediaSources, retrySelection.index);
	}

	return {
		data: retryData,
		selectedSource: retryData.MediaSources[0],
		activePayload: retryPayload,
		requestedAudioStreamIndex: fallbackAudioIndex,
		adjustment: {
			type: 'audioFallback',
			toast: 'Switched audio track for compatibility.'
		}
	};
};
