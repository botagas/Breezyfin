export const buildMediaListItemKey = (scope, item, index) => {
	const normalizedScope = String(scope || 'media').trim() || 'media';
	const itemId = item?.Id ? String(item.Id) : 'missing';
	const normalizedIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
	return `${normalizedScope}-${itemId}-${normalizedIndex}`;
};
