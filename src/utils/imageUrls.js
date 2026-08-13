import {applyPreferredImageFormatToParams} from './imageFormat';
import {AUTH_QUERY_PARAM} from './auth';

export const getFirstImageTag = (value) => (
	Array.isArray(value) && typeof value[0] === 'string' && value[0]
		? value[0]
		: null
);

export const buildItemImageUrl = ({ baseUrl, itemId, imageType, accessToken, width, tag = null, index = null }) => {
	if (!baseUrl || !itemId || !imageType || !accessToken) return '';
	const normalizedBase = baseUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		width: String(width),
		[AUTH_QUERY_PARAM]: accessToken
	});
	if (tag) {
		params.set('tag', tag);
	}
	applyPreferredImageFormatToParams(params);
	const imageSuffix = index == null ? imageType : `${imageType}/${index}`;
	return `${normalizedBase}/Items/${itemId}/Images/${imageSuffix}?${params.toString()}`;
};

export const buildUserPrimaryImageUrl = ({ baseUrl, userId, accessToken, width, tag = null }) => {
	if (!baseUrl || !userId || !accessToken) return '';
	const normalizedBase = baseUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		width: String(width),
		[AUTH_QUERY_PARAM]: accessToken
	});
	if (tag) {
		params.set('tag', tag);
	}
	applyPreferredImageFormatToParams(params);
	return `${normalizedBase}/Users/${userId}/Images/Primary?${params.toString()}`;
};

export const normalizeImageTag = (value) => (
	typeof value === 'string' && value ? value : null
);
