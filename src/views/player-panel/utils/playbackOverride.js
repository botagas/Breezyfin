const isValidSubtitleIndex = (value) => value === -1 || Number.isInteger(value);

const assignIfDefined = (target, key, value) => {
	if (value !== undefined) {
		target[key] = value;
	}
};

export const resolveVideoSeekSeconds = (video, seekOffset = 0) => {
	const currentTime = Number(video?.currentTime) || 0;
	const offset = Number(seekOffset) || 0;
	return Math.max(0, currentTime + offset);
};

export const buildPlaybackOverride = ({
	baseOptions = {},
	mediaSourceId,
	audioStreamIndex,
	subtitleStreamIndex,
	seekSeconds,
	startTimeTicks,
	forceNewSession = true,
	extra = {}
} = {}) => {
	const override = {...(baseOptions || {})};
	const resolvedMediaSourceId = mediaSourceId || baseOptions?.mediaSourceId;

	assignIfDefined(override, 'mediaSourceId', resolvedMediaSourceId);
	if (Number.isInteger(audioStreamIndex)) {
		override.audioStreamIndex = audioStreamIndex;
	}
	if (isValidSubtitleIndex(subtitleStreamIndex)) {
		override.subtitleStreamIndex = subtitleStreamIndex;
	}
	if (Number.isFinite(seekSeconds)) {
		override.seekSeconds = Math.max(0, seekSeconds);
	}
	if (Number.isFinite(startTimeTicks)) {
		override.startTimeTicks = startTimeTicks;
	}
	assignIfDefined(override, 'forceNewSession', forceNewSession);

	return {
		...override,
		...extra
	};
};
