import jellyfinService from '../services/jellyfinService';

const appendQuery = (url, params) => {
	const search = new URLSearchParams();
	Object.entries(params || {}).forEach(([key, value]) => {
		if (value === undefined || value === null || value === '') return;
		search.set(key, String(value));
	});
	return `${url}?${search.toString()}`;
};

const canBuildImageUrl = () => {
	return Boolean(jellyfinService?.serverUrl && jellyfinService?.accessToken);
};

const buildPrimaryImageUrl = (itemId, {maxWidth = 400, tag} = {}) => {
	if (!itemId || !canBuildImageUrl()) return null;
	return appendQuery(
		`${jellyfinService.serverUrl}/Items/${itemId}/Images/Primary`,
		{
			maxWidth,
			tag,
			api_key: jellyfinService.accessToken
		}
	);
};

const buildBackdropImageUrl = (itemId, {maxWidth = 400, index = 0} = {}) => {
	if (!itemId || !canBuildImageUrl()) return null;
	return appendQuery(
		`${jellyfinService.serverUrl}/Items/${itemId}/Images/Backdrop/${index}`,
		{
			maxWidth,
			api_key: jellyfinService.accessToken
		}
	);
};

export const hasStartedWatching = (item) => {
	const userData = item?.UserData;
	if (!userData) return false;
	if (userData.Played) return true;
	if (typeof userData.PlayedPercentage === 'number' && userData.PlayedPercentage > 0) return true;
	if (typeof userData.PlaybackPositionTicks === 'number' && userData.PlaybackPositionTicks > 0) return true;
	return false;
};

export const getPlaybackProgressPercent = (item) => {
	if (!hasStartedWatching(item)) return 0;
	if (item?.UserData?.Played) return 100;
	const percent = item?.UserData?.PlayedPercentage;
	return typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
};

export const getSeriesUnplayedCount = (item) => {
	if (item?.Type !== 'Series') return null;
	const count = item?.UserData?.UnplayedItemCount;
	return Number.isInteger(count) ? count : null;
};

export const getMediaItemSubtitle = (item, {includePersonRole = false} = {}) => {
	switch (item?.Type) {
		case 'Episode':
			return `${item.SeriesName || ''} - S${item.ParentIndexNumber || 0}:E${item.IndexNumber || 0}`;
		case 'Movie':
		case 'Series':
			return item?.ProductionYear ? `${item.ProductionYear}` : '';
		case 'Person':
			return includePersonRole ? (item?.Role || 'Person') : 'Person';
		default:
			return item?.Type || '';
	}
};

// Poster-ish card art for grid/list cards in Favorites/Search/Library.
export const getPosterCardImageUrl = (item, {maxWidth = 400, personMaxWidth = 200, includeBackdrop = true, includeSeriesFallback = true} = {}) => {
	if (!item || !canBuildImageUrl()) return null;

	if (item.Type === 'Person') {
		return buildPrimaryImageUrl(item.Id, {
			maxWidth: personMaxWidth,
			tag: item.PrimaryImageTag
		});
	}

	const taggedPrimary = item?.ImageTags?.Primary
		? buildPrimaryImageUrl(item.Id, {maxWidth, tag: item.ImageTags.Primary})
		: null;
	if (taggedPrimary) return taggedPrimary;

	if (includeBackdrop && Array.isArray(item?.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		return buildBackdropImageUrl(item.Id, {maxWidth, index: 0});
	}

	if (includeSeriesFallback && item?.SeriesId) {
		const seriesPrimary = buildPrimaryImageUrl(item.SeriesId, {
			maxWidth,
			tag: item.SeriesPrimaryImageTag
		});
		if (seriesPrimary) return seriesPrimary;
	}

	return buildPrimaryImageUrl(item.Id, {maxWidth});
};

// Landscape art for Home/MediaRow style cards.
export const getLandscapeCardImageUrl = (item, {width = 640, includeSeriesBackdrop = true} = {}) => {
	if (!item || !canBuildImageUrl()) return '';

	// Prefer episode primary art first for episode-heavy rows.
	if (item?.Type === 'Episode' && item?.ImageTags?.Primary) {
		return jellyfinService.getImageUrl(item.Id, 'Primary', width);
	}

	if (Array.isArray(item?.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		return jellyfinService.getBackdropUrl(item.Id, 0, width);
	}

	if (includeSeriesBackdrop && item?.SeriesId && Array.isArray(item?.ParentBackdropImageTags) && item.ParentBackdropImageTags.length > 0) {
		return jellyfinService.getBackdropUrl(item.SeriesId, 0, width);
	}

	if (item?.ImageTags?.Primary) {
		return jellyfinService.getImageUrl(item.Id, 'Primary', width);
	}

	if (item?.SeriesId) {
		return jellyfinService.getImageUrl(item.SeriesId, 'Primary', width);
	}

	return '';
};
