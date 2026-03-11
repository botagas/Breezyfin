import {HOME_ROW_LABELS} from './constants';

export const getOptionLabel = (options, value, fallback) => {
	const option = options.find((entry) => entry.value === value);
	return option ? option.label : fallback;
};

export const getHomeRowLabel = (rowKey) => {
	return HOME_ROW_LABELS[rowKey] || rowKey;
};

export const getPlayNextPromptModeLabel = (value) => {
	switch (value) {
		case 'segmentsOnly':
			return 'Outro/Credits Only';
		case 'segmentsOrLast60':
		default:
			return 'Segments or Last 60s';
	}
};

export const getCapabilityProbeRefreshLabel = (value) => {
	const days = Number(value);
	if (!Number.isFinite(days) || days <= 0) return '30 days';
	if (days === 1) return '1 day';
	return `${Math.trunc(days)} days`;
};

export const getSubtitleBurnInTextCodecsLabel = (selectedCodecs, options) => {
	const normalizedSelection = Array.isArray(selectedCodecs) ? selectedCodecs : [];
	if (normalizedSelection.length === 0) return 'None (Quality first)';
	const labels = normalizedSelection.map((codec) => {
		const match = options.find((option) => option.value === codec);
		return match?.label || codec;
	});
	return labels.join(', ');
};
