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

