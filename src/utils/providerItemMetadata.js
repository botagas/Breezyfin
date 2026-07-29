const normalizeNames = (value) => {
	const entries = Array.isArray(value) ? value : (value ? [value] : []);
	return entries
		.flatMap((entry) => {
			if (typeof entry === 'string') return entry.split(',');
			return entry?.Name || entry?.name || [];
		})
		.map((entry) => String(entry || '').trim())
		.filter(Boolean);
};

const uniqueNames = (values) => [...new Set(values)];

const getPeopleByRole = (item, role) => {
	const normalizedRole = role.toLowerCase();
	const people = Array.isArray(item?.People) ? item.People : [];
	return people
		.filter((person) => {
			const type = String(person?.Type || '').toLowerCase();
			const personRole = String(person?.Role || '').toLowerCase();
			return type === normalizedRole || personRole.includes(normalizedRole);
		})
		.map((person) => person?.Name)
		.filter(Boolean);
};

const resolveYear = (item) => {
	const productionYear = Number(item?.ProductionYear);
	if (Number.isInteger(productionYear) && productionYear > 0) return String(productionYear);
	const date = item?.ReleaseDate || item?.PremiereDate;
	const year = date ? new Date(date).getFullYear() : NaN;
	return Number.isInteger(year) ? String(year) : '';
};

const resolveRating = (item) => {
	const rating = Number(item?.CommunityRating ?? item?.VoteAverage ?? item?.Rating);
	return Number.isFinite(rating) && rating > 0 ? `${rating.toFixed(1)}/10` : '';
};

export const getProviderItemMetadata = (item) => {
	if (!item) {
		return {
			summary: [],
			rating: '',
			genres: [],
			directors: [],
			writers: []
		};
	}
	const directors = uniqueNames([
		...normalizeNames(item.Directors || item.Director),
		...getPeopleByRole(item, 'Director')
	]);
	const writers = uniqueNames([
		...normalizeNames(item.Writers || item.Writer),
		...getPeopleByRole(item, 'Writer')
	]);
	const type = String(item.Type || item.MediaType || '').trim();
	const year = resolveYear(item);
	const rating = resolveRating(item);
	return {
		summary: [
			type,
			year
		].filter(Boolean),
		rating,
		genres: uniqueNames(normalizeNames(item.Genres)),
		directors,
		writers
	};
};
