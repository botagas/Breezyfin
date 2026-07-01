const ASS_NUMPAD_ALIGNMENT_PATTERN = /\\an([1-9])/i;
const ASS_LEGACY_ALIGNMENT_PATTERN = /\\a(1[01]|[1-9])\b/i;
const ASS_LEGACY_ALIGNMENT_TO_NUMPAD = new Map([
	[1, 1],
	[2, 2],
	[3, 3],
	[5, 7],
	[6, 8],
	[7, 9],
	[9, 4],
	[10, 5],
	[11, 6]
]);

export const SUBTITLE_PLACEMENT_TOP = 'top';
export const SUBTITLE_PLACEMENT_MIDDLE = 'middle';
export const SUBTITLE_PLACEMENT_BOTTOM = 'bottom';
export const SUBTITLE_ALIGN_LEFT = 'left';
export const SUBTITLE_ALIGN_CENTER = 'center';
export const SUBTITLE_ALIGN_RIGHT = 'right';

export const normalizeAssAlignmentNumber = (value) => {
	const numberValue = Number(value);
	return Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= 9 ? numberValue : null;
};

export const getAssAlignmentFromOverrideBlock = (block) => {
	const value = String(block || '');
	const numpadMatch = value.match(ASS_NUMPAD_ALIGNMENT_PATTERN);
	const numpadAlignment = normalizeAssAlignmentNumber(numpadMatch?.[1]);
	if (numpadAlignment !== null) return numpadAlignment;
	const legacyMatch = value.match(ASS_LEGACY_ALIGNMENT_PATTERN);
	const legacyAlignment = Number(legacyMatch?.[1]);
	return ASS_LEGACY_ALIGNMENT_TO_NUMPAD.get(legacyAlignment) || null;
};

export const getPlacementFromAssAlignment = (alignment) => {
	const numberValue = normalizeAssAlignmentNumber(alignment);
	if (numberValue === null) return null;
	if (numberValue >= 7 && numberValue <= 9) return SUBTITLE_PLACEMENT_TOP;
	if (numberValue >= 4 && numberValue <= 6) return SUBTITLE_PLACEMENT_MIDDLE;
	return SUBTITLE_PLACEMENT_BOTTOM;
};

export const getHorizontalAlignFromAssAlignment = (alignment) => {
	const numberValue = normalizeAssAlignmentNumber(alignment);
	if (numberValue === null) return null;
	if (numberValue === 1 || numberValue === 4 || numberValue === 7) return SUBTITLE_ALIGN_LEFT;
	if (numberValue === 3 || numberValue === 6 || numberValue === 9) return SUBTITLE_ALIGN_RIGHT;
	return SUBTITLE_ALIGN_CENTER;
};

export const getPlacementFromAlignment = (value) => {
	const normalized = String(value || '').trim().toLowerCase();
	if (!normalized) return null;
	if (normalized.includes('top')) return SUBTITLE_PLACEMENT_TOP;
	if (normalized.includes('middle')) return SUBTITLE_PLACEMENT_MIDDLE;
	if (normalized.includes('bottom')) return SUBTITLE_PLACEMENT_BOTTOM;
	return null;
};

export const getHorizontalAlignFromAlignment = (value) => {
	const normalized = String(value || '').trim().toLowerCase();
	if (!normalized) return null;
	if (normalized.includes('left')) return SUBTITLE_ALIGN_LEFT;
	if (normalized.includes('right')) return SUBTITLE_ALIGN_RIGHT;
	if (normalized.includes('center') || normalized.includes('middle')) return SUBTITLE_ALIGN_CENTER;
	return null;
};
