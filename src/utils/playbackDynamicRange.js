const normalizeToken = (value) => (value || '').toString().trim().toUpperCase();

export const normalizeDynamicRangeCap = (value) => {
	const normalized = (value || '').toString().trim().toLowerCase();
	if (normalized === 'hdr10' || normalized === 'sdr') return normalized;
	return 'auto';
};

export const normalizeVideoRangeType = (value) => normalizeToken(value);

export const isDolbyVisionRangeType = (rangeType) => {
	const normalized = normalizeVideoRangeType(rangeType);
	return normalized.includes('DOVI') || normalized.includes('DOLBY');
};

export const getDolbyVisionFallbackLayer = (rangeType) => {
	const normalized = normalizeVideoRangeType(rangeType);
	if (!normalized.includes('DOVIWITH')) return null;
	if (normalized.includes('HDR10PLUS') || normalized.includes('HDR10+')) return 'HDR10+';
	if (normalized.includes('HDR10') || normalized.includes('HDR')) return 'HDR10';
	if (normalized.includes('HLG')) return 'HLG';
	if (normalized.includes('SDR')) return 'SDR';
	return null;
};

const resolveVideoStream = (value) => {
	if (!value) return null;
	if (value.Type === 'Video') return value;
	if (Array.isArray(value.MediaStreams)) {
		return value.MediaStreams.find((stream) => stream.Type === 'Video') || null;
	}
	return null;
};

export const getDynamicRangeInfo = (mediaSourceOrVideoStream) => {
	const videoStream = resolveVideoStream(mediaSourceOrVideoStream);
	if (!videoStream) {
		return {
			id: 'SDR',
			label: 'SDR',
			displayLabel: 'SDR',
			rangeType: '',
			videoRange: '',
			isDolbyVision: false,
			isPureDolbyVision: false,
			hasFallbackLayer: false,
			fallbackLayer: null
		};
	}

	const rangeType = normalizeVideoRangeType(videoStream.VideoRangeType);
	const videoRange = normalizeToken(videoStream.VideoRange);
	const isDolbyVision = isDolbyVisionRangeType(rangeType);
	const fallbackLayer = getDolbyVisionFallbackLayer(rangeType);
	const hasFallbackLayer = fallbackLayer != null;

	if (isDolbyVision) {
		return {
			id: 'DV',
			label: 'Dolby Vision',
			displayLabel: 'Dolby Vision',
			rangeType,
			videoRange,
			isDolbyVision: true,
			isPureDolbyVision: !hasFallbackLayer,
			hasFallbackLayer,
			fallbackLayer
		};
	}

	if (rangeType.includes('HDR10PLUS') || rangeType.includes('HDR10+')) {
		return {
			id: 'HDR10_PLUS',
			label: 'HDR10+',
			displayLabel: 'HDR10+',
			rangeType,
			videoRange,
			isDolbyVision: false,
			isPureDolbyVision: false,
			hasFallbackLayer: false,
			fallbackLayer: null
		};
	}

	if (rangeType.includes('HDR10') || rangeType === 'HDR' || rangeType.includes('HDR')) {
		return {
			id: 'HDR10',
			label: 'HDR10',
			displayLabel: 'HDR10',
			rangeType,
			videoRange,
			isDolbyVision: false,
			isPureDolbyVision: false,
			hasFallbackLayer: false,
			fallbackLayer: null
		};
	}

	if (rangeType.includes('HLG')) {
		return {
			id: 'HLG',
			label: 'HLG',
			displayLabel: 'HLG',
			rangeType,
			videoRange,
			isDolbyVision: false,
			isPureDolbyVision: false,
			hasFallbackLayer: false,
			fallbackLayer: null
		};
	}

	if (videoRange === 'HDR') {
		return {
			id: 'HDR10',
			label: 'HDR',
			displayLabel: 'HDR',
			rangeType,
			videoRange,
			isDolbyVision: false,
			isPureDolbyVision: false,
			hasFallbackLayer: false,
			fallbackLayer: null
		};
	}

	return {
		id: 'SDR',
		label: 'SDR',
		displayLabel: 'SDR',
		rangeType,
		videoRange,
		isDolbyVision: false,
		isPureDolbyVision: false,
		hasFallbackLayer: false,
		fallbackLayer: null
	};
};

export const canDynamicRangeSatisfyCap = (dynamicRangeInfo, dynamicRangeCap = 'auto') => {
	const cap = normalizeDynamicRangeCap(dynamicRangeCap);
	const info = dynamicRangeInfo || getDynamicRangeInfo(null);

	if (cap === 'auto') return true;
	if (cap === 'sdr') {
		if (info.id === 'SDR') return true;
		return info.id === 'DV' && info.fallbackLayer === 'SDR';
	}

	if (info.id !== 'DV') return true;
	if (!info.hasFallbackLayer) return false;
	return ['HDR10', 'HDR10+', 'HLG', 'SDR'].includes(info.fallbackLayer);
};

export const getDynamicRangeDisplayLabel = (dynamicRangeInfo, dynamicRangeCap = 'auto') => {
	const cap = normalizeDynamicRangeCap(dynamicRangeCap);
	const info = dynamicRangeInfo || getDynamicRangeInfo(null);

	if (cap === 'sdr') return 'SDR';
	if (cap === 'hdr10' && info.id === 'DV') {
		if (info.fallbackLayer === 'HDR10+' || info.fallbackLayer === 'HDR10') return 'HDR10 fallback';
		if (info.fallbackLayer === 'HLG') return 'HLG fallback';
		if (info.fallbackLayer === 'SDR') return 'SDR fallback';
		return 'HDR fallback';
	}
	return info.displayLabel || info.label || 'SDR';
};
