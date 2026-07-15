import jellyfinService from '../services/jellyfinService';

const canBuildImageUrl = () => {
	return Boolean(jellyfinService?.serverUrl && jellyfinService?.accessToken);
};

const buildPrimaryImageUrl = (itemId, {maxWidth = 400, tag, quality, blur} = {}) => {
	if (!itemId || !canBuildImageUrl()) return null;
	return jellyfinService.getImageUrl(itemId, 'Primary', maxWidth, {tag, quality, blur});
};

const buildBackdropImageUrl = (itemId, {maxWidth = 400, index = 0, tag, quality, blur} = {}) => {
	if (!itemId || !canBuildImageUrl()) return null;
	return jellyfinService.getBackdropUrl(itemId, index, maxWidth, {tag, quality, blur});
};

export const uniqueImageCandidates = (candidates = []) => {
	const unique = [];
	candidates.forEach((candidate) => {
		if (typeof candidate !== 'string' || !candidate || unique.includes(candidate)) return;
		unique.push(candidate);
	});
	return unique;
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

const PLAYABLE_VIDEO_ITEM_TYPES = new Set([
	'Episode',
	'Movie',
	'MusicVideo',
	'Trailer',
	'Video'
]);

export const isPlayableMediaItem = (item) => (
	Boolean(item) && (
		item.MediaType === 'Video' ||
		PLAYABLE_VIDEO_ITEM_TYPES.has(item.Type)
	)
);

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

export const getPosterCardImageUrls = (item, {
	maxWidth = 400,
	personMaxWidth = 200,
	includeBackdrop = true,
	includeSeriesFallback = true,
	quality = 78
} = {}) => {
	if (!item || !canBuildImageUrl()) return [];
	const candidates = [];
	const addCandidate = (url) => {
		if (url) candidates.push(url);
	};

	if (item.Type === 'Person') {
		if (item.PrimaryImageTag) {
			addCandidate(buildPrimaryImageUrl(item.Id, {
				maxWidth: personMaxWidth,
				tag: item.PrimaryImageTag,
				quality
			}));
		}
		addCandidate(buildPrimaryImageUrl(item.Id, {maxWidth: personMaxWidth, quality}));
		return uniqueImageCandidates(candidates);
	}

	if (item?.ImageTags?.Primary) {
		addCandidate(buildPrimaryImageUrl(item.Id, {
			maxWidth,
			tag: item.ImageTags.Primary,
			quality
		}));
	}

	if (includeBackdrop && Array.isArray(item?.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		addCandidate(buildBackdropImageUrl(item.Id, {
			maxWidth,
			index: 0,
			tag: item.BackdropImageTags[0],
			quality
		}));
	}

	if (includeSeriesFallback && item?.SeriesId) {
		addCandidate(buildPrimaryImageUrl(item.SeriesId, {
			maxWidth,
			tag: item.SeriesPrimaryImageTag,
			quality
		}));
	}

	addCandidate(buildPrimaryImageUrl(item.Id, {maxWidth, quality}));
	return uniqueImageCandidates(candidates);
};

export const getPosterCardImageUrl = (item, options = {}) => (
	getPosterCardImageUrls(item, options)[0] || null
);

export const getLandscapeCardImageUrls = (item, {
	width = 640,
	includeSeriesBackdrop = true,
	quality = 76
} = {}) => {
	if (!item || !canBuildImageUrl()) return [];
	const candidates = [];
	const addCandidate = (url) => {
		if (url) candidates.push(url);
	};

	// Prefer episode primary art first for episode-heavy rows.
	if (item?.Type === 'Episode' && item?.ImageTags?.Primary) {
		addCandidate(jellyfinService.getImageUrl(item.Id, 'Primary', width, {
			tag: item.ImageTags.Primary,
			quality
		}));
	}

	if (Array.isArray(item?.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		addCandidate(jellyfinService.getBackdropUrl(item.Id, 0, width, {
			tag: item.BackdropImageTags[0],
			quality
		}));
	}

	const parentBackdropItemId = item?.ParentBackdropItemId || item?.SeriesId;
	if (includeSeriesBackdrop && parentBackdropItemId && Array.isArray(item?.ParentBackdropImageTags) && item.ParentBackdropImageTags.length > 0) {
		addCandidate(jellyfinService.getBackdropUrl(parentBackdropItemId, 0, width, {
			tag: item.ParentBackdropImageTags[0],
			quality
		}));
	}

	if (item?.Type !== 'Episode' && item?.ImageTags?.Primary) {
		addCandidate(jellyfinService.getImageUrl(item.Id, 'Primary', width, {
			tag: item.ImageTags.Primary,
			quality
		}));
	}

	if (item?.SeriesId) {
		addCandidate(jellyfinService.getImageUrl(item.SeriesId, 'Primary', width, {
			tag: item.SeriesPrimaryImageTag,
			quality
		}));
	}

	addCandidate(jellyfinService.getImageUrl(item.Id, 'Primary', width, {quality}));
	return uniqueImageCandidates(candidates);
};

export const getLandscapeCardImageUrl = (item, options = {}) => (
	getLandscapeCardImageUrls(item, options)[0] || ''
);

export const getMediaPanelBackdropUrls = (item, {
	width = 960,
	quality = 70,
	blur
} = {}) => {
	if (!item || !canBuildImageUrl()) return [];

	const candidates = [];
	const addCandidate = (url) => {
		if (url && !candidates.includes(url)) candidates.push(url);
	};
	const ownBackdropTag = item?.BackdropImageTags?.[0];
	const parentBackdropTag = item?.ParentBackdropImageTags?.[0];
	const parentBackdropItemId = item?.ParentBackdropItemId || item?.SeriesId;

	const imageOptions = {quality, blur};
	addCandidate(jellyfinService.getBackdropUrl(item.Id, 0, width, {...imageOptions, tag: ownBackdropTag}));
	if (parentBackdropItemId) {
		addCandidate(jellyfinService.getBackdropUrl(parentBackdropItemId, 0, width, {...imageOptions, tag: parentBackdropTag}));
	}
	if (item?.Type === 'Episode' && item?.ImageTags?.Primary) {
		addCandidate(jellyfinService.getImageUrl(item.Id, 'Primary', width, {
			...imageOptions,
			tag: item.ImageTags.Primary
		}));
	}
	addCandidate(jellyfinService.getImageUrl(item.Id, 'Primary', width, {
		...imageOptions,
		tag: item?.ImageTags?.Primary || item?.PrimaryImageTag
	}));
	if (item?.SeriesId) {
		addCandidate(jellyfinService.getBackdropUrl(item.SeriesId, 0, width, imageOptions));
		addCandidate(jellyfinService.getImageUrl(item.SeriesId, 'Primary', width, {
			...imageOptions,
			tag: item.SeriesPrimaryImageTag
		}));
	}

	return candidates;
};
