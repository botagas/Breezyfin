import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import {
	determinePlayMethod,
	findBestCompatibleAudioStreamIndex,
	getAudioStreams,
	getDefaultAudioStreamIndex,
	isSupportedAudioCodec,
	reorderMediaSources,
	selectMediaSource,
	shouldTranscodeForSubtitleSelection,
	toInteger
} from './playbackSelection';
import {buildPlaybackRequestContext} from './playbackProfileBuilder';

const fetchPlaybackInfo = async (service, itemId, payload) => {
	const response = await fetch(`${service.serverUrl}/Items/${itemId}/PlaybackInfo?userId=${service.userId}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Emby-Token': service.accessToken
		},
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		service._handleAuthFailureStatus(response.status);
		const errorText = await response.text();
		console.error('PlaybackInfo error response:', errorText);
		const compactError = String(errorText || '').replace(/\s+/g, ' ').trim().slice(0, 280);
		throw new Error(`HTTP ${response.status}: ${response.statusText}${compactError ? ` - ${compactError}` : ''}`);
	}
	return response.json();
};

const buildPlaystatePayload = (basePayload, session = {}) => {
	const payload = {
		...basePayload,
		PlayMethod: session.playMethod || basePayload.PlayMethod || 'DirectStream'
	};
	if (session.playSessionId) payload.PlaySessionId = session.playSessionId;
	if (session.mediaSourceId) payload.MediaSourceId = session.mediaSourceId;
	if (Number.isInteger(session.audioStreamIndex)) payload.AudioStreamIndex = session.audioStreamIndex;
	if (session.subtitleStreamIndex === -1 || Number.isInteger(session.subtitleStreamIndex)) {
		payload.SubtitleStreamIndex = session.subtitleStreamIndex;
	}
	return payload;
};

const attachPlaybackInfoMetadata = (data, {
	playMethod,
	selectedSource,
	selectedAudioStreamIndex,
	adjustments
}) => {
	data.__breezyfin = {
		playMethod,
		selectedMediaSourceId: selectedSource?.Id || null,
		selectedAudioStreamIndex,
		adjustments
	};
	return data;
};

export const getItemPlaybackInfo = async (service, itemId, options = {}) => {
	try {
		const {
			payload,
			forceTranscoding,
			enableTranscoding,
			requestedAudioStreamIndex: initialRequestedAudioStreamIndex
		} = buildPlaybackRequestContext(options);
		let requestedAudioStreamIndex = initialRequestedAudioStreamIndex;

		let data = await fetchPlaybackInfo(service, itemId, payload);
		const adjustments = [];

		if (!data?.MediaSources?.length) {
			return data;
		}

		const sourceSelection = selectMediaSource(data.MediaSources, {
			preferredMediaSourceId: options.mediaSourceId,
			forceTranscoding
		});
		if (sourceSelection.index > 0) {
			data.MediaSources = reorderMediaSources(data.MediaSources, sourceSelection.index);
			adjustments.push({
				type: 'sourceSelection',
				toast: 'Playback source optimized for this TV.'
			});
		}

		let selectedSource = data.MediaSources[0];

		if (!Number.isInteger(options.audioStreamIndex) && !forceTranscoding && selectedSource) {
			const defaultAudioIndex = getDefaultAudioStreamIndex(selectedSource);
			const fallbackAudioIndex = findBestCompatibleAudioStreamIndex(selectedSource);
			if (defaultAudioIndex !== null && fallbackAudioIndex !== null && defaultAudioIndex !== fallbackAudioIndex) {
				const defaultAudioStream = getAudioStreams(selectedSource).find((stream) => toInteger(stream.Index) === defaultAudioIndex);
				const defaultCodecSupported = isSupportedAudioCodec(defaultAudioStream?.Codec);
				if (!defaultCodecSupported) {
					const retryPayload = {
						...payload,
						MediaSourceId: selectedSource.Id,
						AudioStreamIndex: fallbackAudioIndex
					};
					const retryData = await fetchPlaybackInfo(service, itemId, retryPayload);
					if (retryData?.MediaSources?.length) {
						data = retryData;
						const retrySelection = selectMediaSource(data.MediaSources, {
							preferredMediaSourceId: selectedSource.Id,
							forceTranscoding
						});
						if (retrySelection.index > 0) {
							data.MediaSources = reorderMediaSources(data.MediaSources, retrySelection.index);
						}
						selectedSource = data.MediaSources[0];
						requestedAudioStreamIndex = fallbackAudioIndex;
						adjustments.push({
							type: 'audioFallback',
							toast: 'Switched audio track for compatibility.'
						});
					}
				}
			}
		}

		const selectedSubtitleStreamIndex = toInteger(payload.SubtitleStreamIndex);
		const subtitleNeedsTranscoding =
			selectedSubtitleStreamIndex !== null &&
			selectedSubtitleStreamIndex >= 0 &&
			shouldTranscodeForSubtitleSelection(selectedSource, selectedSubtitleStreamIndex);
		let playMethod = determinePlayMethod(selectedSource, {
			forceTranscoding: forceTranscoding || subtitleNeedsTranscoding
		});
		if (subtitleNeedsTranscoding) {
			adjustments.push({
				type: 'subtitleTranscodeGuard',
				toast: 'Using transcoding for subtitle compatibility.'
			});
		}
		if (playMethod === 'Transcode' && !selectedSource?.TranscodingUrl && enableTranscoding) {
			const transcodePayload = {
				...payload,
				EnableDirectPlay: false,
				EnableDirectStream: false,
				EnableTranscoding: true
			};
			if (selectedSource?.Id) {
				transcodePayload.MediaSourceId = selectedSource.Id;
			}
			if (Number.isInteger(requestedAudioStreamIndex)) {
				transcodePayload.AudioStreamIndex = requestedAudioStreamIndex;
			}
			const transcodedData = await fetchPlaybackInfo(service, itemId, transcodePayload);
			if (transcodedData?.MediaSources?.length) {
				data = transcodedData;
				const transcodeSelection = selectMediaSource(data.MediaSources, {
					preferredMediaSourceId: selectedSource?.Id,
					forceTranscoding: true
				});
				if (transcodeSelection.index > 0) {
					data.MediaSources = reorderMediaSources(data.MediaSources, transcodeSelection.index);
				}
				selectedSource = data.MediaSources[0];
				playMethod = 'Transcode';
				adjustments.push({
					type: 'forcedTranscode',
					toast: 'Using transcoding for compatibility.'
				});
			}
		}

		return attachPlaybackInfoMetadata(data, {
			playMethod,
			selectedSource,
			selectedAudioStreamIndex: requestedAudioStreamIndex,
			adjustments
		});
	} catch (error) {
		console.error('Failed to get playback info:', error);
		throw error;
	}
};

export const getPlaybackStreamUrl = (service, itemId, mediaSourceId, playSessionId, tag, container, liveStreamId) => {
	let url = `${service.serverUrl}/Videos/${itemId}/stream?static=true&api_key=${service.accessToken}`;
	if (mediaSourceId) {
		url += `&mediaSourceId=${mediaSourceId}`;
	}
	if (playSessionId) {
		url += `&playSessionId=${playSessionId}`;
	}
	if (tag) {
		url += `&tag=${tag}`;
	}
	if (container) {
		url += `&container=${container}`;
	}
	if (liveStreamId) {
		url += `&liveStreamId=${liveStreamId}`;
	}
	return url;
};

export const getTranscodePlaybackUrl = (service, playSessionId, mediaSource) => {
	if (mediaSource.TranscodingUrl) {
		return `${service.serverUrl}${mediaSource.TranscodingUrl}`;
	}
	return null;
};

export const reportPlaybackStarted = async (service, itemId, positionTicks = 0, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackStart({
		playbackStartInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			IsPaused: false,
			IsMuted: false,
			PlayMethod: 'DirectStream'
		}, session)
	});
};

export const reportPlaybackProgressState = async (service, itemId, positionTicks, isPaused = false, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackProgress({
		playbackProgressInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			IsPaused: isPaused,
			IsMuted: false,
			PlayMethod: 'DirectStream'
		}, session)
	});
};

export const reportPlaybackStoppedState = async (service, itemId, positionTicks, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackStopped({
		playbackStopInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			PlayMethod: 'DirectStream'
		}, session)
	});
};
