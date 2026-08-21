import {redactSensitiveUrl} from '../../../utils/sensitiveData';
import {createPlaybackRuntimeContext} from '../utils/playbackRuntimeContext';

const normalizeToastText = (value) => (
	String(value || '')
		.replace(/\s+/g, ' ')
		.replace(/[.]+$/, '')
		.trim()
		.toLowerCase()
);

const buildPlaybackCompatibilityToast = ({
	dynamicRangeLabel,
	resolvedPlayMethod,
	adjustments = []
}) => {
	const toastParts = [];
	if (dynamicRangeLabel) {
		toastParts.push(`Playback: ${dynamicRangeLabel} (${resolvedPlayMethod})`);
	}
	if (Array.isArray(adjustments)) {
		adjustments.forEach((adjustment) => {
			if (adjustment?.toast) toastParts.push(adjustment.toast);
		});
	}
	const seen = new Set();
	return toastParts.filter((part) => {
		const normalized = normalizeToastText(part);
		if (!normalized || seen.has(normalized)) return false;
		seen.add(normalized);
		return true;
	}).join('  •  ');
};

export const commitPlaybackPlan = async (playbackPlan, transaction) => {
	const {
		item,
		generation,
		loadOptions,
		playbackSettingsSnapshot,
		isStale,
		refs,
		actions
	} = transaction;
	if (!playbackPlan || isStale()) return {status: 'stale'};

	const mediaSource = playbackPlan.mediaSource;
	const playbackMeta = playbackPlan.playbackMetadata || {};
	const resolvedPlayMethod = playbackPlan.playMethod;
	const dynamicRangeInfo = playbackPlan.dynamicRange;
	const compatibilityToast = buildPlaybackCompatibilityToast({
		dynamicRangeLabel: playbackPlan.dynamicRangeLabel,
		resolvedPlayMethod,
		adjustments: playbackPlan.adjustments
	});
	if (compatibilityToast) actions.setToastMessage(compatibilityToast);

	if (playbackSettingsSnapshot.forceTranscoding && !mediaSource.TranscodingUrl) {
		throw new Error('Transcoding was forced, but the server did not return a transcoding URL.');
	}
	refs.playbackSettings.current = playbackSettingsSnapshot;
	refs.playbackSession.current = {...playbackPlan.session};

	const mediaSourceDebugData = playbackPlan.runtimeInput.mediaSourceData;
	actions.setMediaSourceData({
		...mediaSource,
		...mediaSourceDebugData,
		__itemId: item.Id,
		__playbackGeneration: generation
	});
	if (Number.isFinite(playbackPlan.durationSeconds)) {
		actions.setDuration(playbackPlan.durationSeconds);
	}

	const audioStreams = playbackPlan.tracks.audio;
	const subtitleStreams = playbackPlan.tracks.subtitle;
	const selectedAudio = playbackPlan.tracks.selectedAudioStreamIndex;
	const selectedSubtitle = playbackPlan.tracks.selectedSubtitleStreamIndex;
	actions.setAudioTracks(audioStreams);
	actions.setSubtitleTracks(subtitleStreams);
	if (!loadOptions?.deferTrackState) {
		actions.setCurrentAudioTrack(selectedAudio);
		actions.setCurrentSubtitleTrack(selectedSubtitle);
	}

	const requiredDecision = playbackPlan.decision.required;
	if (requiredDecision) {
		const isVideoQualityDecision = [
			'dynamic-range-fallback',
			'dolby-vision-original-quality'
		].includes(requiredDecision.type);
		const decisionScope = requiredDecision.type === 'unsupported-audio-switch'
			? 'audio-track'
			: (isVideoQualityDecision ? 'dynamic-range' : 'subtitle-policy');
		const decisionMessage = requiredDecision.type === 'unsupported-audio-switch'
			? 'Waiting for audio decision...'
			: (isVideoQualityDecision
				? 'Waiting for video quality decision...'
				: 'Waiting for subtitle decision...');
		actions.appendPlaybackDiagnostic?.({
			scope: decisionScope,
			stage: 'required-decision',
			status: 'pending-user-consent',
			reason: requiredDecision.reason || requiredDecision.type || 'playback-decision-required',
			message: 'Playback startup is blocked until the playback decision is resolved.'
		});
		actions.setLoading(false);
		actions.setLoadingStatusMessage(decisionMessage);
		if (!loadOptions?.deferDecisions) {
			await actions.requestPlaybackDecision?.({
				...requiredDecision,
				itemId: item.Id,
				mediaSourceId: requiredDecision.mediaSourceId || mediaSource.Id,
				generation,
				subtitleStreamIndex: Number.isInteger(requiredDecision.subtitleStreamIndex)
					? requiredDecision.subtitleStreamIndex
					: selectedSubtitle
			});
		}
		return {status: 'decision', decision: requiredDecision};
	}

	const videoUrl = playbackPlan.source.url;
	const isHls = playbackPlan.source.isHls;
	const runtimeMediaSourceData = {
		...mediaSource,
		...mediaSourceDebugData,
		__itemId: item.Id,
		__playbackGeneration: generation,
		__debugVideoUrl: redactSensitiveUrl(videoUrl),
		__debugIsHls: isHls,
		__debugHlsEngine: isHls ? 'pending' : null
	};
	const playbackRuntimeContext = createPlaybackRuntimeContext({
		generation,
		itemId: item.Id,
		mediaSourceData: runtimeMediaSourceData,
		playMethod: resolvedPlayMethod,
		dynamicRange: dynamicRangeInfo,
		subtitlePolicy: playbackMeta.subtitlePolicy || mediaSourceDebugData.__debugSubtitlePolicy,
		selectedAudioTrack: selectedAudio,
		selectedSubtitleTrack: selectedSubtitle,
		playbackOptions: playbackSettingsSnapshot,
		audioTransition: refs.playbackOverride.current?.audioTransition || null,
		requiresInitialNativeAudioSelection:
			playbackPlan.runtimeInput.requiresInitialNativeAudioSelection
	});
	refs.playbackRuntimeContext.current = playbackRuntimeContext;
	actions.setMediaSourceData((previousValue) => ({
		...(previousValue || mediaSource),
		...mediaSourceDebugData,
		__itemId: item.Id,
		__playbackGeneration: generation,
		__debugVideoUrl: redactSensitiveUrl(videoUrl),
		__debugIsHls: isHls,
		__debugHlsEngine: isHls ? 'pending' : null
	}));
	refs.pendingOverrideClear.current = Boolean(refs.playbackOverride.current);

	if (!refs.video.current) throw new Error('Video element not available');
	if (isStale()) return {status: 'stale'};
	const sourceToken = actions.attachPlaybackSource?.({
		url: videoUrl,
		transport: playbackPlan.source.transport,
		isHls,
		isHdrLikeStream: playbackPlan.source.isHdrLikeStream,
		playMethod: resolvedPlayMethod,
		serverBurnIn: playbackPlan.source.serverBurnIn,
		runtimeContext: playbackRuntimeContext,
		onEngineSelected: (engine) => {
			if (isStale()) return;
			actions.setMediaSourceData((previousValue) => ({
				...(previousValue || mediaSource),
				__debugHlsEngine: isHls ? engine : null
			}));
		}
	});
	if (!sourceToken && !isStale()) {
		throw new Error('Playback source could not be attached');
	}
	if (isStale()) return {status: 'stale'};
	return {
		status: 'attached',
		sourceToken,
		generation,
		playMethod: resolvedPlayMethod,
		playbackPlan
	};
};

export default commitPlaybackPlan;
