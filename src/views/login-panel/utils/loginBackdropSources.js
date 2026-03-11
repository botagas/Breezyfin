import {shuffleArray} from '../../../utils/arrayUtils';
import {
	LOGIN_BACKDROP_IMAGE_FIELDS,
	LOGIN_BACKDROP_ITEM_LIMIT,
	LOGIN_BACKDROP_MAX_IMAGES,
	LOGIN_BACKDROP_WIDTH,
	buildItemImageUrl,
	buildUserPrimaryImageUrl,
	getFirstImageTag,
	normalizeImageTag
} from './loginImageUrls';

export const selectAvailableBackdropServers = (savedServers) => (
	(savedServers || [])
		.filter((entry) => entry?.url && entry?.userId && entry?.accessToken)
		.slice(0, 4)
);

export const fetchBackdropsForSavedServer = async (entry, signal) => {
	if (!entry?.url || !entry?.userId || !entry?.accessToken) return [];
	const baseUrl = entry.url.replace(/\/+$/, '');
	const requestUrls = [
		`${baseUrl}/Users/${entry.userId}/Items?includeItemTypes=Movie,Series,Episode&recursive=true&limit=${LOGIN_BACKDROP_ITEM_LIMIT}&sortBy=DateCreated&sortOrder=Descending&fields=${LOGIN_BACKDROP_IMAGE_FIELDS}&imageTypeLimit=1&enableTotalRecordCount=false`,
		`${baseUrl}/Users/${entry.userId}/Items/Resume?limit=${LOGIN_BACKDROP_ITEM_LIMIT}&fields=${LOGIN_BACKDROP_IMAGE_FIELDS}&imageTypeLimit=1`
	];

	try {
		const responses = await Promise.all(
			requestUrls.map((requestUrl) => (
				fetch(requestUrl, {
					headers: {
						'X-Emby-Token': entry.accessToken
					},
					signal
				}).catch(() => null)
			))
		);
		const payloads = await Promise.all(
			responses
				.filter((response) => response?.ok)
				.map((response) => response.json().catch(() => null))
		);
		const items = [];
		payloads.forEach((data) => {
			if (Array.isArray(data?.Items)) {
				items.push(...data.Items);
			}
		});
		if (items.length === 0) return [];
		const urls = [];
		const addImageUrl = (itemId, imageType, tag = null, index = null) => {
			const imageUrl = buildItemImageUrl({
				baseUrl,
				itemId,
				imageType,
				accessToken: entry.accessToken,
				width: LOGIN_BACKDROP_WIDTH,
				tag,
				index
			});
			if (imageUrl) {
				urls.push(imageUrl);
			}
		};

		items.forEach((item) => {
			if (!item?.Id) return;
			const backdropTag = getFirstImageTag(item.BackdropImageTags)
				|| (typeof item.ImageTags?.Backdrop === 'string' && item.ImageTags.Backdrop ? item.ImageTags.Backdrop : null);
			if (backdropTag) {
				addImageUrl(item.Id, 'Backdrop', backdropTag, 0);
			}

			const primaryTag = item.PrimaryImageTag || item.ImageTags?.Primary || null;
			if (primaryTag) {
				addImageUrl(item.Id, 'Primary', primaryTag);
			}

			if (item.SeriesId && item.SeriesPrimaryImageTag) {
				addImageUrl(item.SeriesId, 'Primary', item.SeriesPrimaryImageTag);
			}

			if (item.ParentBackdropItemId) {
				const parentBackdropTag = getFirstImageTag(item.ParentBackdropImageTags);
				if (parentBackdropTag) {
					addImageUrl(item.ParentBackdropItemId, 'Backdrop', parentBackdropTag, 0);
				}
			}
		});
		return [...new Set(urls)];
	} catch (err) {
		if (err?.name === 'AbortError') return [];
		return [];
	}
};

export const resolveSavedUserBackdrop = async (entry, signal) => {
	if (!entry?.url || !entry?.userId || !entry?.accessToken) return '';
	const baseUrl = entry.url.replace(/\/+$/, '');
	let tag = normalizeImageTag(entry.avatarTag);

	if (!tag) {
		try {
			const response = await fetch(`${baseUrl}/Users/${entry.userId}`, {
				headers: {
					'X-Emby-Token': entry.accessToken
				},
				signal
			});
			if (response?.ok) {
				const data = await response.json().catch(() => null);
				tag = normalizeImageTag(data?.PrimaryImageTag);
			}
		} catch (err) {
			if (err?.name === 'AbortError') return '';
		}
	}

	return buildUserPrimaryImageUrl({
		baseUrl: entry.url,
		userId: entry.userId,
		accessToken: entry.accessToken,
		width: LOGIN_BACKDROP_WIDTH,
		tag
	});
};

export const buildShuffledBackdropList = (perServerBackdrops, fallbackUserBackdrops) => {
	const uniqueBackdrops = [...new Set((perServerBackdrops || []).flat().filter(Boolean))];
	const candidateBackdrops = [...new Set([
		...uniqueBackdrops,
		...(fallbackUserBackdrops || []).filter(Boolean)
	])];
	return shuffleArray(candidateBackdrops).slice(0, LOGIN_BACKDROP_MAX_IMAGES);
};
