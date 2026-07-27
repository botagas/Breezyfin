import {getLandscapeCardImageUrls, uniqueImageCandidates} from './mediaItemUtils';

export const normalizeDiscoveryMediaItem = (item) => {
	const linkedItem = item?.JellyfinItemId ? {...item, Id: item.JellyfinItemId} : null;
	return {
		...item,
		IsDiscoveryItem: true,
		Name: item?.Title || item?.Name || '',
		Type: item?.Type,
		ImageCandidates: uniqueImageCandidates([
			item?.AuthenticatedImageUrl,
			...(linkedItem ? getLandscapeCardImageUrls(linkedItem, {width: 640, quality: 76}) : [])
		])
	};
};
