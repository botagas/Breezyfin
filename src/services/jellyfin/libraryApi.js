export const getLatestMediaItems = async (service, includeItemTypes = ['Movie', 'Series'], limit = 16) => {
	try {
		const types = Array.isArray(includeItemTypes) ? includeItemTypes.join(',') : includeItemTypes;
		return await service._fetchItems(
			`/Users/${service.userId}/Items?includeItemTypes=${types}&limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,Tags,TagItems,UserData,ChildCount&imageTypeLimit=1`,
			{},
			'getLatestMedia'
		);
	} catch (error) {
		console.error(`getLatestMedia ${includeItemTypes} error:`, error);
		return [];
	}
};

export const getRecentlyAddedItems = async (service, limit = 20) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Items?limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&includeItemTypes=Movie,Series&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
			{},
			'getRecentlyAdded'
		);
	} catch (error) {
		console.error('getRecentlyAdded error:', error);
		return [];
	}
};

export const getNextUpItems = async (service, limit = 24) => {
	try {
		return await service._fetchItems(
			`/Shows/NextUp?userId=${service.userId}&limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1&enableTotalRecordCount=false`,
			{},
			'getNextUp'
		);
	} catch (error) {
		console.error('Failed to get next up:', error);
		return [];
	}
};

export const getResumeMediaItems = async (service, limit = 10) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Items/Resume?limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
			{},
			'getResumeItems'
		);
	} catch (error) {
		console.error('getResumeItems error:', error);
		return [];
	}
};

export const getLibraryViewItems = async (service) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Views`,
			{},
			'getLibraryViews'
		);
	} catch (error) {
		console.error('getLibraryViews error:', error);
		return [];
	}
};

export const getLibraryChildItems = async (service, parentId, itemTypes, limit = 100, startIndex = 0) => {
	try {
		let url = `${service.serverUrl}/Users/${service.userId}/Items?parentId=${parentId}&limit=${limit}&startIndex=${startIndex}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData,ChildCount`;

		if (itemTypes) {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			url += `&includeItemTypes=${types}`;
		}

		return await service._fetchItems(url, {}, 'getLibraryItems');
	} catch (error) {
		console.error('getLibraryItems error:', error);
		return [];
	}
};

export const getItemDetails = async (service, itemId) => {
	try {
		return await service._request(
			`/Users/${service.userId}/Items/${itemId}?fields=Overview,Genres,People,Studios,MediaStreams`,
			{
				context: 'getItem'
			}
		);
	} catch (error) {
		console.error('getItem error:', error);
		return null;
	}
};

export const getSeriesSeasons = async (service, seriesId) => {
	try {
		return await service._fetchItems(
			`/Shows/${seriesId}/Seasons?userId=${service.userId}&fields=Overview`,
			{},
			'getSeasons'
		);
	} catch (error) {
		console.error('getSeasons error:', error);
		return [];
	}
};

export const getSeasonEpisodes = async (service, seriesId, seasonId) => {
	try {
		return await service._fetchItems(
			`/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${service.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
			{},
			'getEpisodes'
		);
	} catch (error) {
		console.error('getEpisodes error:', error);
		return [];
	}
};

export const getNextUpEpisodeForSeries = async (service, seriesId) => {
	try {
		const data = await service._request(
			`/Shows/NextUp?seriesId=${seriesId}&userId=${service.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
			{
				context: 'getNextUpEpisode'
			}
		);
		if (data.Items && data.Items.length > 0) {
			return data.Items[0];
		}
		const seasonsData = await service._request(
			`/Shows/${seriesId}/Seasons?userId=${service.userId}`,
			{
				context: 'getNextUpEpisode seasons'
			}
		);
		if (seasonsData.Items && seasonsData.Items.length > 0) {
			const firstSeason = seasonsData.Items.find((season) => season.IndexNumber > 0) || seasonsData.Items[0];
			const episodes = await service.getEpisodes(seriesId, firstSeason.Id);
			return episodes[0] || null;
		}

		return null;
	} catch (error) {
		console.error('getNextUpEpisode error:', error);
		return null;
	}
};

export const searchLibraryItems = async (service, searchTerm, itemTypes = null, limit = 25, startIndex = 0) => {
	try {
		let url = `${service.serverUrl}/Users/${service.userId}/Items?searchTerm=${encodeURIComponent(searchTerm)}&limit=${limit}&startIndex=${Math.max(0, Number(startIndex) || 0)}&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1&enableTotalRecordCount=false`;

		if (itemTypes && itemTypes.length > 0) {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			url += `&includeItemTypes=${types}`;
		}

		return await service._fetchItems(url, {}, 'search');
	} catch (error) {
		console.error('search error:', error);
		return [];
	}
};

export const getFavoriteMediaItems = async (service, itemTypes = ['Movie', 'Series'], limit = 100) => {
	try {
		const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
		return await service._fetchItems(
			`/Users/${service.userId}/Items?filters=IsFavorite&includeItemTypes=${types}&limit=${limit}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1`,
			{},
			'getFavorites'
		);
	} catch (error) {
		console.error('getFavorites error:', error);
		return [];
	}
};

export const getSystemInfo = async (service) => {
	try {
		return await service._request('/System/Info', {
			context: 'getServerInfo'
		});
	} catch (error) {
		console.error('getServerInfo error:', error);
		return null;
	}
};

export const getPublicSystemInfo = async (service) => {
	try {
		return await service._request('/System/Info/Public', {
			includeAuth: false,
			context: 'getPublicServerInfo',
			suppressAuthHandling: true
		});
	} catch (error) {
		console.error('getPublicServerInfo error:', error);
		return null;
	}
};

export const getItemMediaSegments = async (service, itemId) => {
	if (!service.serverUrl || !service.accessToken || !itemId) return [];
	try {
		const data = await service._request(`/MediaSegments/${itemId}`, {
			context: 'getMediaSegments'
		});
		return Array.isArray(data?.Items) ? data.Items : [];
	} catch (error) {
		console.error('getMediaSegments error:', error);
		return [];
	}
};
