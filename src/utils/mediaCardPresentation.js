const formatEpisodePart = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return '??';
	return String(Math.trunc(parsed)).padStart(2, '0');
};

export const getEpisodeContextBadge = (item) => {
	if (item?.Type !== 'Episode') return '';
	return `S${formatEpisodePart(item.ParentIndexNumber)}E${formatEpisodePart(item.IndexNumber)}`;
};

export const getMediaCardPresentation = (item, {includePersonRole = false} = {}) => {
	if (item?.Type === 'Episode') {
		const episodeTitle = item.Name || 'Episode';
		const seriesTitle = item.SeriesName || '';
		const contextBadge = getEpisodeContextBadge(item);
		return {
			title: episodeTitle,
			subtitle: seriesTitle,
			contextBadge,
			ariaLabel: [seriesTitle, contextBadge, episodeTitle].filter(Boolean).join(' - ')
		};
	}
	if (item?.Type === 'Season') {
		const seasonTitle = item.Name || (
			Number.isInteger(item.IndexNumber) ? `Season ${item.IndexNumber}` : 'Season'
		);
		const seriesTitle = item.SeriesName || '';
		return {
			title: seasonTitle,
			subtitle: seriesTitle,
			contextBadge: '',
			ariaLabel: [seriesTitle, seasonTitle].filter(Boolean).join(' - ')
		};
	}

	const title = item?.Name || '';
	let subtitle = '';
	if (item?.Type === 'Movie' || item?.Type === 'Series') {
		subtitle = item?.ProductionYear ? String(item.ProductionYear) : '';
	} else if (item?.Type === 'Person') {
		subtitle = includePersonRole ? (item?.Role || 'Person') : 'Person';
	} else {
		subtitle = item?.Type || '';
	}
	return {
		title,
		subtitle,
		contextBadge: '',
		ariaLabel: [title, subtitle].filter(Boolean).join(' - ')
	};
};
