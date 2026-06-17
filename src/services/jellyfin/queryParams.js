export const normalizeOptionalQueryValue = (value) => {
	if (value === null || value === undefined) return null;
	const normalized = String(value).trim();
	if (!normalized) return null;
	const lowered = normalized.toLowerCase();
	if (lowered === 'null' || lowered === 'undefined') return null;
	return normalized;
};
