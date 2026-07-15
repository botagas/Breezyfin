import {
	findBestCompatibleAudioStreamIndex,
	getAudioStreams,
	getDefaultAudioStreamIndex,
	getMediaSourceDynamicRangeInfo,
	isSupportedAudioCodec,
	reorderMediaSources,
	selectMediaSource,
	toInteger
} from '../../../utils/playbackSelection';
import {hasNonTranscodingDirectPath, usesMkvContainer} from './dolbyVision';
import {fetchPlaybackInfo} from './network';
import {appendPlaybackDiagnostic} from '../../../utils/playbackDiagnostics';
import {resolveAudioTrackIndex} from '../../../utils/trackMatching';

const parseTranscodeReasons = (transcodingUrl) => {
	if (!transcodingUrl) return [];
	try {
		const searchParams = new URL(transcodingUrl, 'https://breezyfin.invalid').searchParams;
		const value = searchParams.get('TranscodeReasons') || searchParams.get('transcodeReasons') || '';
		if (!value) return [];
		return value
			.split(',')
			.map((reason) => String(reason || '').trim())
			.filter(Boolean);
	} catch (_) {
		return [];
	}
};

const hasAudioRelatedTranscodeReason = (mediaSource) => {
	const reasons = parseTranscodeReasons(mediaSource?.TranscodingUrl);
	if (!reasons.length) return false;
	return reasons.some((reason) => reason.toLowerCase().startsWith('audio') || reason === 'UnknownAudioStreamInfo');
};

export const attemptAudioTrackIntentRemap = async ({
	service,
	itemId,
	activePayload,
	selectedSource,
	audioTrackIntent,
	createSourceSelectionOptions,
	diagnostics
}) => {
	if (!audioTrackIntent || !selectedSource) return null;
	const defaultAudioStreamIndex = getDefaultAudioStreamIndex(selectedSource);
	const match = resolveAudioTrackIndex({
		audioStreams: getAudioStreams(selectedSource),
		intent: audioTrackIntent,
		fallbackIndex: defaultAudioStreamIndex
	});
	const addDiagnostic = (entry) => appendPlaybackDiagnostic(diagnostics, {
		scope: 'audio-track',
		stage: 'audio-intent-remap',
		...entry
	});
	addDiagnostic({
		status: match.method === 'no-match' ? 'no-match' : 'applied',
		reason: match.method,
		message: Number.isInteger(match.index)
			? `Audio intent resolved to stream ${match.index}.`
			: 'Audio intent could not be resolved; using the source default.'
	});
	if (
		!Number.isInteger(match.index) ||
		match.method === 'no-match' ||
		toInteger(activePayload.AudioStreamIndex) === match.index
	) {
		return {requestedAudioStreamIndex: Number.isInteger(match.index) ? match.index : defaultAudioStreamIndex};
	}

	const payload = {
		...activePayload,
		MediaSourceId: selectedSource.Id || activePayload.MediaSourceId,
		AudioStreamIndex: match.index
	};
	const data = await fetchPlaybackInfo(service, itemId, payload);
	if (!data?.MediaSources?.length) {
		addDiagnostic({
			status: 'failed',
			reason: 'empty-playback-info',
			message: 'Mapped audio request returned no source; retaining the initial source default.'
		});
		return {requestedAudioStreamIndex: defaultAudioStreamIndex};
	}
	const selection = selectMediaSource(
		data.MediaSources,
		createSourceSelectionOptions({preferredMediaSourceId: selectedSource.Id})
	);
	if (selection.index > 0) {
		data.MediaSources = reorderMediaSources(data.MediaSources, selection.index);
	}
	return {
		data,
		selectedSource: data.MediaSources[0],
		activePayload: payload,
		requestedAudioStreamIndex: match.index
	};
};

export const attemptDirectAudioCompatibilityProbe = async ({
	service,
	itemId,
	activePayload,
	selectedSource,
	options,
	forceTranscoding,
	forceDolbyVision,
	requestedAudioStreamIndex,
	createSourceSelectionOptions,
	diagnostics
}) => {
	const addDiagnostic = (entry) => appendPlaybackDiagnostic(diagnostics, {
		scope: 'playback-probe',
		stage: 'direct-audio',
		...entry
	});
	const canAttemptDirectAudioCompatibilityProbe =
		!forceTranscoding &&
		!Number.isInteger(options.audioStreamIndex) &&
		selectedSource?.TranscodingUrl;

	if (!canAttemptDirectAudioCompatibilityProbe) {
		addDiagnostic({
			status: 'skipped',
			reason: forceTranscoding
				? 'force-transcoding'
				: (Number.isInteger(options.audioStreamIndex) ? 'explicit-audio-track' : 'no-transcoding-url'),
			message: 'Direct-audio probe was not applicable.'
		});
		return null;
	}

	const normalizedPreferredAudioLanguage = String(options.preferredAudioLanguage || '').trim().toLowerCase();
	const currentAudioIndex = Number.isInteger(requestedAudioStreamIndex)
		? requestedAudioStreamIndex
		: getDefaultAudioStreamIndex(selectedSource);
	const currentAudioStream = getAudioStreams(selectedSource)
		.find((stream) => toInteger(stream?.Index) === currentAudioIndex);
	const currentAudioLanguage = String(currentAudioStream?.Language || '').trim().toLowerCase();
	const shouldProbeForAudioCompatibility =
		forceDolbyVision ||
		!isSupportedAudioCodec(currentAudioStream?.Codec) ||
		hasAudioRelatedTranscodeReason(selectedSource);
	if (!shouldProbeForAudioCompatibility) {
		addDiagnostic({
			status: 'skipped',
			reason: 'audio-compatible',
			message: 'Selected audio track did not require a direct-audio probe.'
		});
		return null;
	}
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
	if (compatibleAudioProbeIndexes.length === 0) {
		addDiagnostic({
			status: 'skipped',
			reason: 'no-compatible-audio-candidate',
			message: 'No alternate direct-audio-compatible track was available.'
		});
		return null;
	}

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
			if (!directAudioProbeData?.MediaSources?.length) {
				addDiagnostic({
					status: 'no-match',
					reason: 'empty-playback-info',
					message: `Direct-audio probe returned no source for audio index ${audioStreamIndex}.`
				});
				continue;
			}
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
				addDiagnostic({
					status: 'no-match',
					reason: 'no-direct-path',
					message: `Audio index ${audioStreamIndex} still required transcoding.`
				});
				continue;
			}
			if (forceDolbyVision && getMediaSourceDynamicRangeInfo(directAudioProbeSource)?.id !== 'DV') {
				addDiagnostic({
					status: 'no-match',
					reason: 'not-dolby-vision',
					message: `Audio index ${audioStreamIndex} did not preserve Dolby Vision.`
				});
				continue;
			}
			addDiagnostic({
				status: 'applied',
				reason: 'direct-path-found',
				message: `Selected audio index ${audioStreamIndex} to preserve direct playback.`
			});
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
			addDiagnostic({
				status: 'failed',
				reason: 'request-failed',
				message: directAudioProbeError?.message || 'Direct audio compatibility probe failed.'
			});
		}
	}

	addDiagnostic({
		status: 'no-match',
		reason: 'no-better-source',
		message: 'Direct-audio probe found no better source.'
	});
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
	buildPayloadWithoutMkvDirectPlay,
	diagnostics
}) => {
	const addDiagnostic = (entry) => appendPlaybackDiagnostic(diagnostics, {
		scope: 'playback-probe',
		stage: 'dolby-vision-mkv-retry',
		...entry
	});
	const canAttemptDolbyVisionMkvCompatibilityRetry =
		!forceTranscoding &&
		enableTranscoding &&
		runtimeSupportsDolbyVision === true &&
		usesMkvContainer(selectedSource) &&
		getMediaSourceDynamicRangeInfo(selectedSource)?.id === 'HDR10';

	if (!canAttemptDolbyVisionMkvCompatibilityRetry) {
		addDiagnostic({
			status: 'skipped',
			reason: forceTranscoding
				? 'force-transcoding'
				: (runtimeSupportsDolbyVision !== true ? 'no-runtime-dv-support' : 'not-hdr10-mkv-source'),
			message: 'Dolby Vision MKV compatibility retry was not applicable.'
		});
		return null;
	}

	const dvCompatibilityPayload = buildPayloadWithoutMkvDirectPlay(activePayload, selectedSource?.Id || null);
	if (!dvCompatibilityPayload) {
		addDiagnostic({
			status: 'skipped',
			reason: 'payload-unavailable',
			message: 'Could not build a non-MKV direct-play retry payload.'
		});
		return null;
	}

	try {
		const dvRetryData = await fetchPlaybackInfo(service, itemId, dvCompatibilityPayload);
		if (!dvRetryData?.MediaSources?.length) {
			addDiagnostic({
				status: 'no-match',
				reason: 'empty-playback-info',
				message: 'Dolby Vision MKV retry returned no media sources.'
			});
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
			addDiagnostic({
				status: 'no-match',
				reason: 'no-improved-source',
				message: 'Dolby Vision MKV retry did not produce a better source.'
			});
			return null;
		}
		addDiagnostic({
			status: 'applied',
			reason: 'improved-source',
			message: 'Dolby Vision MKV compatibility retry selected an improved source.'
		});
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
		addDiagnostic({
			status: 'failed',
			reason: 'request-failed',
			message: dvRetryError?.message || 'Dolby Vision MKV compatibility retry failed.'
		});
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
	createSourceSelectionOptions,
	diagnostics
}) => {
	const addDiagnostic = (entry) => appendPlaybackDiagnostic(diagnostics, {
		scope: 'playback-probe',
		stage: 'default-audio-fallback',
		...entry
	});
	if (Number.isInteger(options.audioStreamIndex) || forceTranscoding || !selectedSource) {
		addDiagnostic({
			status: 'skipped',
			reason: Number.isInteger(options.audioStreamIndex)
				? 'explicit-audio-track'
				: (forceTranscoding ? 'force-transcoding' : 'no-selected-source'),
			message: 'Default-audio fallback was not applicable.'
		});
		return null;
	}

	const defaultAudioIndex = getDefaultAudioStreamIndex(selectedSource);
	const fallbackAudioIndex = findBestCompatibleAudioStreamIndex(selectedSource);
	if (defaultAudioIndex === null || fallbackAudioIndex === null || defaultAudioIndex === fallbackAudioIndex) {
		addDiagnostic({
			status: 'skipped',
			reason: 'no-alternate-compatible-audio',
			message: 'No alternate compatible audio fallback was available.'
		});
		return null;
	}

	const defaultAudioStream = getAudioStreams(selectedSource).find((stream) => toInteger(stream.Index) === defaultAudioIndex);
	const defaultCodecSupported = isSupportedAudioCodec(defaultAudioStream?.Codec);
	if (defaultCodecSupported) {
		addDiagnostic({
			status: 'skipped',
			reason: 'default-audio-compatible',
			message: 'Default audio track was already compatible.'
		});
		return null;
	}

	const retryPayload = {
		...activePayload,
		MediaSourceId: selectedSource.Id,
		AudioStreamIndex: fallbackAudioIndex
	};
	let retryData = null;
	try {
		retryData = await fetchPlaybackInfo(service, itemId, retryPayload);
	} catch (fallbackError) {
		console.warn('Default audio fallback probe failed:', fallbackError);
		addDiagnostic({
			status: 'failed',
			reason: 'request-failed',
			message: fallbackError?.message || 'Default audio fallback probe failed.'
		});
		return null;
	}
	if (!retryData?.MediaSources?.length) {
		addDiagnostic({
			status: 'no-match',
			reason: 'empty-playback-info',
			message: 'Default audio fallback returned no media sources.'
		});
		return null;
	}

	const retrySelection = selectMediaSource(
		retryData.MediaSources,
		createSourceSelectionOptions({preferredMediaSourceId: selectedSource.Id})
	);
	if (retrySelection.index > 0) {
		retryData.MediaSources = reorderMediaSources(retryData.MediaSources, retrySelection.index);
	}

	addDiagnostic({
		status: 'applied',
		reason: 'compatible-audio-selected',
		message: `Selected audio index ${fallbackAudioIndex} for compatibility.`
	});
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
