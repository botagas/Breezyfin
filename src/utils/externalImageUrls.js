const EXTERNAL_IMAGE_PATH_PREFIX = '/Breezyfin/ExternalImages/';

const normalizeInteger = (value, minimum, maximum) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
};

export const buildExternalImageVariantUrl = (imageUrl, {
	width,
	quality,
	blur
} = {}) => {
	if (typeof imageUrl !== 'string' || imageUrl.length === 0) return '';
	let url;
	try {
		url = new URL(imageUrl);
	} catch (_) {
		return imageUrl;
	}
	if (!url.pathname.startsWith(EXTERNAL_IMAGE_PATH_PREFIX)) return imageUrl;

	const safeWidth = normalizeInteger(width, 64, 1920);
	const safeQuality = normalizeInteger(quality, 1, 100);
	const safeBlur = normalizeInteger(blur, 0, 100);
	if (safeWidth !== null) url.searchParams.set('width', String(safeWidth));
	if (safeQuality !== null) url.searchParams.set('quality', String(safeQuality));
	if (safeBlur !== null && safeBlur > 0) url.searchParams.set('blur', String(safeBlur));
	else url.searchParams.delete('blur');
	return url.toString();
};
