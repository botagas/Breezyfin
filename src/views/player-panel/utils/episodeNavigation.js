const toSeasonId = (item) => {
	return item?.SeasonId || item?.ParentId || null;
};

const sortSeasons = (seasons) => {
	return [...seasons].sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
};

const canNavigateEpisode = (item) => {
	return Boolean(item && item.Type === 'Episode' && item.SeriesId);
};

export const getNextEpisodeForItem = async (service, item) => {
	if (!service || !canNavigateEpisode(item)) return null;

	const seasonId = toSeasonId(item);
	if (!seasonId) return null;

	const seasonEpisodes = await service.getEpisodes(item.SeriesId, seasonId);
	const currentIndex = seasonEpisodes.findIndex((episode) => episode.Id === item.Id);
	if (currentIndex >= 0 && currentIndex < seasonEpisodes.length - 1) {
		return seasonEpisodes[currentIndex + 1];
	}

	const seasons = await service.getSeasons(item.SeriesId);
	if (!Array.isArray(seasons) || seasons.length === 0) return null;

	const sortedSeasons = sortSeasons(seasons);
	const currentSeasonIndex = sortedSeasons.findIndex((season) => season.Id === seasonId);
	if (currentSeasonIndex >= 0 && currentSeasonIndex < sortedSeasons.length - 1) {
		const nextSeason = sortedSeasons[currentSeasonIndex + 1];
		const nextSeasonEpisodes = await service.getEpisodes(item.SeriesId, nextSeason.Id);
		return nextSeasonEpisodes?.[0] || null;
	}

	return null;
};

export const getPreviousEpisodeForItem = async (service, item) => {
	if (!service || !canNavigateEpisode(item)) return null;

	const seasonId = toSeasonId(item);
	if (!seasonId) return null;

	const seasonEpisodes = await service.getEpisodes(item.SeriesId, seasonId);
	const currentIndex = seasonEpisodes.findIndex((episode) => episode.Id === item.Id);
	if (currentIndex > 0) {
		return seasonEpisodes[currentIndex - 1];
	}

	const seasons = await service.getSeasons(item.SeriesId);
	if (!Array.isArray(seasons) || seasons.length === 0) return null;

	const sortedSeasons = sortSeasons(seasons);
	const currentSeasonIndex = sortedSeasons.findIndex((season) => season.Id === seasonId);
	if (currentSeasonIndex > 0) {
		const previousSeason = sortedSeasons[currentSeasonIndex - 1];
		const previousEpisodes = await service.getEpisodes(item.SeriesId, previousSeason.Id);
		return previousEpisodes?.[previousEpisodes.length - 1] || null;
	}

	return null;
};
