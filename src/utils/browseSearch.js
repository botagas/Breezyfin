const normalizeSearchValue = (value) => String(value || '');

export const getBrowseSearchEventValue = (event) => (
	normalizeSearchValue(event?.value ?? event?.target?.value ?? '')
);

export const normalizeBrowseSearchValue = (value) => normalizeSearchValue(value);

export const getBrowseControlNavigationTarget = ({
	keyCode,
	source,
	searchVisible = false,
	searchSpotlightId = '',
	filterSpotlightId = ''
} = {}) => {
	if (source === 'filter' && keyCode === 37 && searchVisible) {
		return searchSpotlightId;
	}
	if (source === 'search' && keyCode === 39) {
		return filterSpotlightId;
	}
	return '';
};
