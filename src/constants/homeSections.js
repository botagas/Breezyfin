export const HOME_SECTION_IDS = {
	RECENTLY_ADDED: 'recentlyAdded',
	CONTINUE_WATCHING: 'continueWatching',
	NEXT_UP: 'nextUp',
	LATEST_MOVIES: 'latestMovies',
	LATEST_SHOWS: 'latestShows',
	MY_REQUESTS: 'myRequests',
	WATCHLIST: 'watchlist'
};

export const HOME_SECTION_DESCRIPTORS = {
	[HOME_SECTION_IDS.RECENTLY_ADDED]: {
		id: HOME_SECTION_IDS.RECENTLY_ADDED,
		title: 'Recently Added'
	},
	[HOME_SECTION_IDS.CONTINUE_WATCHING]: {
		id: HOME_SECTION_IDS.CONTINUE_WATCHING,
		title: 'Continue Watching'
	},
	[HOME_SECTION_IDS.NEXT_UP]: {
		id: HOME_SECTION_IDS.NEXT_UP,
		title: 'Next Up'
	},
	[HOME_SECTION_IDS.LATEST_MOVIES]: {
		id: HOME_SECTION_IDS.LATEST_MOVIES,
		title: 'Latest Movies'
	},
	[HOME_SECTION_IDS.LATEST_SHOWS]: {
		id: HOME_SECTION_IDS.LATEST_SHOWS,
		title: 'Latest TV Shows'
	},
	[HOME_SECTION_IDS.MY_REQUESTS]: {
		id: HOME_SECTION_IDS.MY_REQUESTS,
		title: 'My Requests'
	},
	[HOME_SECTION_IDS.WATCHLIST]: {
		id: HOME_SECTION_IDS.WATCHLIST,
		title: 'Watchlist'
	}
};

export const getHomeSectionDescriptor = (sectionId) => (
	HOME_SECTION_DESCRIPTORS[sectionId] || null
);

export const isMyRequestsHomeSection = (section) => (
	section === HOME_SECTION_IDS.MY_REQUESTS ||
	section?.id === HOME_SECTION_IDS.MY_REQUESTS ||
	section?.kind === 'MyRequests'
);
