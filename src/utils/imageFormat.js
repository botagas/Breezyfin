import {getRuntimePlatformCapabilities} from './platformCapabilities';

const WEBP_IMAGE_FORMAT = 'Webp';
const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

const normalizeFormatToken = (value) => String(value || '').trim().toLowerCase();

export const isWebpImageFormat = (value) => {
	const normalized = normalizeFormatToken(value);
	return normalized === 'webp' || normalized === 'image/webp';
};

export const getPreferredImageFormat = () => {
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	if (runtimeCapabilities?.playback?.supportsWebpImage === true) {
		return WEBP_IMAGE_FORMAT;
	}
	return null;
};

export const applyPreferredImageFormatToParams = (searchParams, options = {}) => {
	if (!searchParams || typeof searchParams.set !== 'function') return null;
	const explicitFormat = typeof options.format === 'string' && options.format.trim()
		? options.format.trim()
		: null;
	if (explicitFormat) {
		searchParams.set('format', explicitFormat);
		return explicitFormat;
	}
	if (options.disablePreferredFormat === true) return null;
	const preferredFormat = getPreferredImageFormat();
	if (!preferredFormat) return null;
	searchParams.set('format', preferredFormat);
	return preferredFormat;
};

export const stripPreferredImageFormatFromUrl = (url) => {
	if (typeof url !== 'string' || !url) return null;
	if (!/format=/i.test(url)) return null;

	const isAbsoluteUrl = ABSOLUTE_URL_PATTERN.test(url);
	const fallbackBase = typeof window !== 'undefined' && window.location?.origin
		? window.location.origin
		: 'http://localhost';

	let parsedUrl;
	try {
		parsedUrl = isAbsoluteUrl ? new URL(url) : new URL(url, fallbackBase);
	} catch (_) {
		return null;
	}

	const formatValue = parsedUrl.searchParams.get('format');
	if (!isWebpImageFormat(formatValue)) return null;
	parsedUrl.searchParams.delete('format');

	if (isAbsoluteUrl) {
		return parsedUrl.toString();
	}

	const normalizedPath = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
	if (url.startsWith('/')) return normalizedPath;
	return normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
};

export const applyImageFormatFallbackOnElement = (image) => {
	if (!image) return false;
	const currentSource = image.currentSrc || image.src || '';
	const downgradedSource = stripPreferredImageFormatFromUrl(currentSource);
	if (!downgradedSource || image.dataset.bfImageFormatFallback === downgradedSource) {
		return false;
	}
	image.dataset.bfImageFormatFallback = downgradedSource;
	image.style.display = '';
	image.src = downgradedSource;
	return true;
};

export const applyImageFormatFallbackFromEvent = (event) => {
	const image = event?.currentTarget || event?.target;
	return applyImageFormatFallbackOnElement(image);
};
