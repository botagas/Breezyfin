export const getSubtitleBurnInDiagnosticMessage = (subtitlePolicy) => {
	const codecLabel = subtitlePolicy?.codec ? ` (${subtitlePolicy.codec})` : '';
	if (subtitlePolicy?.requiresBurnIn === true) {
		return `Subtitle policy requires server-side burn-in/transcoding${codecLabel}.`;
	}
	if (subtitlePolicy?.reason === 'skip-hdr-dv-preserve-range') {
		return `Subtitle burn-in was skipped to preserve HDR/DV${codecLabel}.`;
	}
	if (subtitlePolicy?.clientRender === true) {
		return `Subtitle policy selected client-side rendering${codecLabel}.`;
	}
	return `Subtitle policy does not require server-side burn-in${codecLabel}.`;
};

const parseTranscodingUrlSearchParams = (transcodingUrl) => {
	if (!transcodingUrl) return new URLSearchParams();
	try {
		return new URL(transcodingUrl, 'http://breezyfin.local').searchParams;
	} catch (error) {
		return new URLSearchParams();
	}
};

export const validateSubtitleBurnInTranscodingUrl = (mediaSource, subtitleStreamIndex) => {
	const params = parseTranscodingUrlSearchParams(mediaSource?.TranscodingUrl);
	const subtitleMethod = params.get('SubtitleMethod') || params.get('subtitleMethod') || '';
	const subtitleIndexRaw = params.get('SubtitleStreamIndex') || params.get('subtitleStreamIndex');
	const subtitleIndexNumber = subtitleIndexRaw === null ? null : Number(subtitleIndexRaw);
	const urlSubtitleIndex = Number.isInteger(subtitleIndexNumber) ? subtitleIndexNumber : null;
	const hasEncodeMethod = String(subtitleMethod).toLowerCase() === 'encode';
	const hasExpectedSubtitleIndex = !Number.isInteger(subtitleStreamIndex) || urlSubtitleIndex === subtitleStreamIndex;
	const segmentContainer = params.get('SegmentContainer') || params.get('segmentContainer') || null;
	const videoCodec = params.get('VideoCodec') || params.get('videoCodec') || null;
	const audioCodec = params.get('AudioCodec') || params.get('audioCodec') || null;
	const maxAudioChannels = params.get('TranscodingMaxAudioChannels') ||
		params.get('transcodingMaxAudioChannels') ||
		params.get('MaxAudioChannels') ||
		params.get('maxAudioChannels') ||
		null;
	const transcodeReasons = params.get('TranscodeReasons') || params.get('transcodeReasons') || null;
	return {
		ok: mediaSource?.TranscodingUrl && hasEncodeMethod && hasExpectedSubtitleIndex,
		subtitleMethod: subtitleMethod || null,
		subtitleStreamIndex: Number.isInteger(urlSubtitleIndex) ? urlSubtitleIndex : null,
		hasEncodeMethod,
		hasExpectedSubtitleIndex,
		segmentContainer,
		videoCodec,
		audioCodec,
		maxAudioChannels,
		transcodeReasons
	};
};

export const formatBurnInUrlValidationMessage = (validation) => {
	const details = [
		`method=${validation?.subtitleMethod || '-'}`,
		`index=${validation?.subtitleStreamIndex ?? '-'}`,
		`container=${validation?.segmentContainer || '-'}`,
		`video=${validation?.videoCodec || '-'}`,
		`audio=${validation?.audioCodec || '-'}`,
		`maxAudio=${validation?.maxAudioChannels || '-'}`,
		`reasons=${validation?.transcodeReasons || '-'}`
	].join(', ');
	return validation?.ok
		? `Transcoding URL contains encoded subtitle delivery (${details}).`
		: `Transcoding URL did not include expected encoded subtitle delivery (${details}).`;
};
