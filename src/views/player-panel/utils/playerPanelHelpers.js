export const formatPlaybackTime = (seconds) => {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const toPositiveInteger = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	const integerValue = Math.trunc(parsed);
	if (integerValue < 0) return null;
	return integerValue;
};

export const getPlayerHeaderTitle = (item) => {
	const baseTitle = item?.Name || 'Unknown title';
	if (item?.Type !== 'Episode') return baseTitle;
	const seasonNumber = toPositiveInteger(item?.ParentIndexNumber);
	const episodeNumber = toPositiveInteger(item?.IndexNumber);
	if (seasonNumber == null || episodeNumber == null) return baseTitle;
	return `S${seasonNumber}E${episodeNumber}: ${baseTitle}`;
};

export const getPlayerTrackLabel = (track) => {
	if (!track || typeof track !== 'object') return 'Track';
	const parts = [];
	if (track.Title) parts.push(track.Title);
	if (track.Language) parts.push(String(track.Language).toUpperCase());
	if (track.Codec) parts.push(String(track.Codec).toUpperCase());
	if (track.Channels) parts.push(`${track.Channels}ch`);
	return parts.join(' - ') || `Track ${track.Index}`;
};

export const getSkipSegmentLabel = (segmentType, hasNextEpisode = false) => {
	switch (segmentType) {
		case 'Intro':
			return 'Skip Intro';
		case 'Recap':
			return 'Skip Recap';
		case 'Preview':
			return 'Skip Preview';
		case 'Outro':
		case 'Credits':
			return hasNextEpisode ? 'Next Episode' : 'Skip Credits';
		default:
			return 'Skip';
	}
};

export const getPlayerErrorBackdropUrl = (item, imageApi) => {
	if (!item || !imageApi) return '';
	if (Array.isArray(item?.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		return imageApi.getBackdropUrl(item.Id, 0, 1920);
	}
	if (item?.SeriesId) {
		return imageApi.getBackdropUrl(item.SeriesId, 0, 1920);
	}
	if (item?.ImageTags?.Primary) {
		return imageApi.getImageUrl(item.Id, 'Primary', 1920);
	}
	return '';
};
