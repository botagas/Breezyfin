import {applyPreferredImageFormatToParams} from '../../../utils/imageFormat';

export const LOGIN_BACKDROP_ITEM_LIMIT = 40;
export const LOGIN_BACKDROP_WIDTH = 1920;
export const LOGIN_BACKDROP_MAX_IMAGES = 24;
export const LOGIN_BACKDROP_ROTATE_INTERVAL_MS = 9000;
export const LOGIN_BACKDROP_TRANSITION_MS = 500;
export const LOGIN_BACKDROP_IMAGE_FIELDS = [
	'BackdropImageTags',
	'ImageTags',
	'PrimaryImageTag',
	'SeriesId',
	'SeriesPrimaryImageTag',
	'ParentBackdropItemId',
	'ParentBackdropImageTags'
].join(',');

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
		api_key: accessToken
	});
	if (tag) {
		params.set('tag', tag);
	}
	applyPreferredImageFormatToParams(params);
	const imageSuffix = index == null ? imageType : `${imageType}/${index}`;
	return `${normalizedBase}/Items/${itemId}/Images/${imageSuffix}?${params.toString()}`;
};

export const buildUserPrimaryImageUrl = ({ baseUrl, userId, accessToken, width, tag = null }) => {
	if (!baseUrl || !userId || !accessToken || !tag) return '';
	const normalizedBase = baseUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		width: String(width),
		api_key: accessToken,
		tag
	});
	applyPreferredImageFormatToParams(params);
	return `${normalizedBase}/Users/${userId}/Images/Primary?${params.toString()}`;
};

export const normalizeImageTag = (value) => (
	typeof value === 'string' && value ? value : null
);
