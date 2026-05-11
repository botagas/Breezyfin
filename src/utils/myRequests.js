const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildUserRequestTagPattern = (username) => {
	const normalized = String(username || '').trim();
	if (!normalized) return null;
	return new RegExp(`^\\s*\\d+\\s*-\\s*${escapeRegex(normalized)}\\s*$`, 'i');
};

export const getItemTags = (item) => {
	const inlineTags = Array.isArray(item?.Tags) ? item.Tags : [];
	const tagItems = Array.isArray(item?.TagItems)
		? item.TagItems.map((tag) => tag?.Name).filter(Boolean)
		: [];
	return [...inlineTags, ...tagItems].filter(Boolean);
};

export const itemMatchesUserRequestTag = (item, username) => {
	const pattern = buildUserRequestTagPattern(username);
	if (!pattern) return false;
	const tags = getItemTags(item);
	return tags.some((tag) => pattern.test(String(tag)));
};

export const filterItemsByUserRequestTags = (items, username) => {
	if (!Array.isArray(items) || items.length === 0) return [];
	return items.filter((item) => itemMatchesUserRequestTag(item, username));
};
