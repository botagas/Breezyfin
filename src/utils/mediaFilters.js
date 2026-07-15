import {itemMatchesUserRequestTag} from './myRequests';

export const MEDIA_FILTER_OPTIONS = [
	{id: 'all', label: 'All'},
	{id: 'unplayed', label: 'Unplayed'},
	{id: 'played', label: 'Played'},
	{id: 'favorites', label: 'Favorites'},
	{id: 'myRequests', label: 'My Requests'}
];

const ALLOWED_FILTER_IDS = new Set(MEDIA_FILTER_OPTIONS.map((entry) => entry.id));

export const normalizeMediaFilterIds = (filterIds = []) => {
	const candidateIds = Array.isArray(filterIds) ? filterIds : [];
	const unique = [];
	candidateIds.forEach((id) => {
		if (!ALLOWED_FILTER_IDS.has(id)) return;
		if (unique.includes(id)) return;
		unique.push(id);
	});
	if (unique.length === 0) return ['all'];
	const nonAll = unique.filter((id) => id !== 'all');
	return nonAll.length > 0 ? nonAll : ['all'];
};

export const areMediaFilterSelectionsEqual = (left = [], right = []) => {
	if (!Array.isArray(left) || !Array.isArray(right)) return false;
	if (left.length !== right.length) return false;
	return left.every((id, index) => id === right[index]);
};

export const getMediaItemPlayedState = (item) => {
	const userData = item?.UserData || {};
	if (Number.isFinite(userData.UnplayedItemCount)) {
		return Number(userData.UnplayedItemCount) <= 0;
	}
	if (userData.Played === true) return true;
	if (Number.isFinite(userData.PlayedPercentage)) {
		return Number(userData.PlayedPercentage) >= 100;
	}
	return false;
};

export const isFavoriteMediaItem = (item) => item?.UserData?.IsFavorite === true;

export const buildMediaFilterState = (filterIds = ['all']) => {
	const normalized = normalizeMediaFilterIds(filterIds);
	const selected = new Set(normalized);
	const hasPlayed = selected.has('played');
	const hasUnplayed = selected.has('unplayed');
	const includeFavorites = selected.has('favorites');
	const useMyRequestsSource = selected.has('myRequests');
	const requirePlayed = hasPlayed && !hasUnplayed;
	const requireUnplayed = hasUnplayed && !hasPlayed;
	const serverFilters = [];
	if (includeFavorites) serverFilters.push('IsFavorite');
	if (requirePlayed) serverFilters.push('IsPlayed');
	if (requireUnplayed) serverFilters.push('IsUnplayed');
	return {
		filterIds: normalized,
		useMyRequestsSource,
		includeFavorites,
		requirePlayed,
		requireUnplayed,
		serverFilters: serverFilters.length > 0 ? serverFilters.join(',') : null
	};
};

export const mediaItemMatchesFilters = (item, {
	includeFavorites = false,
	requirePlayed = false,
	requireUnplayed = false,
	useMyRequestsSource = false,
	username = ''
} = {}, {
	requestMembershipSatisfied = false
} = {}) => {
	if (includeFavorites && !isFavoriteMediaItem(item)) return false;
	if (requirePlayed && !getMediaItemPlayedState(item)) return false;
	if (requireUnplayed && getMediaItemPlayedState(item)) return false;
	if (useMyRequestsSource && !requestMembershipSatisfied && !itemMatchesUserRequestTag(item, username)) return false;
	return true;
};
