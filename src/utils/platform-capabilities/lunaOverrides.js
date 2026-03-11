const parseBooleanLike = (value) => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (value === 1) return true;
		if (value === 0) return false;
		return null;
	}
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
		return true;
	}
	if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
		return false;
	}
	return null;
};

export const buildLunaCapabilityOverrides = (configs) => {
	const supportsDolbyVision = parseBooleanLike(configs?.['tv.model.supportDolbyVisionHDR']);
	const supportsHdr = parseBooleanLike(configs?.['tv.model.supportHDR']);
	const supportsHdr10 = supportsHdr;
	const supportsHlg = supportsHdr;
	if (
		typeof supportsDolbyVision !== 'boolean' &&
		typeof supportsHdr10 !== 'boolean' &&
		typeof supportsHlg !== 'boolean'
	) {
		return null;
	}
	return {
		supportsDolbyVision,
		supportsHdr10,
		supportsHlg
	};
};

export const applyRuntimeLunaOverridesToCapabilities = (capabilities, lunaOverrides) => {
	if (!capabilities || !capabilities.playback || !lunaOverrides) {
		return capabilities;
	}
	const hasDolbyVisionOverride = typeof lunaOverrides.supportsDolbyVision === 'boolean';
	const hasHdr10Override = typeof lunaOverrides.supportsHdr10 === 'boolean';
	const hasHlgOverride = typeof lunaOverrides.supportsHlg === 'boolean';
	if (!hasDolbyVisionOverride && !hasHdr10Override && !hasHlgOverride) {
		return capabilities;
	}
	const supportsDolbyVision = hasDolbyVisionOverride
		? lunaOverrides.supportsDolbyVision
		: capabilities.playback.supportsDolbyVision;
	return {
		...capabilities,
		playback: {
			...capabilities.playback,
			supportsDolbyVision,
			supportsDolbyVisionInMkv: supportsDolbyVision
				? capabilities.playback.supportsDolbyVisionInMkv
				: false,
			supportsHdr10: hasHdr10Override
				? lunaOverrides.supportsHdr10
				: capabilities.playback.supportsHdr10,
			supportsHlg: hasHlgOverride
				? lunaOverrides.supportsHlg
				: capabilities.playback.supportsHlg,
			capabilitySignals: {
				...(capabilities.playback.capabilitySignals || {}),
				...(hasDolbyVisionOverride ? {supportsDolbyVision: 'luna-config'} : {}),
				...(hasHdr10Override ? {supportsHdr10: 'luna-config'} : {}),
				...(hasHlgOverride ? {supportsHlg: 'luna-config'} : {})
			}
		}
	};
};
