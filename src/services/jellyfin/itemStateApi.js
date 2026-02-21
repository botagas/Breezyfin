export const toggleFavoriteItem = async (service, itemId, isFavorite) => {
	try {
		const method = isFavorite ? 'DELETE' : 'POST';
		await service._request(
			`/Users/${service.userId}/FavoriteItems/${itemId}`,
			{
				method,
				expectJson: false,
				context: 'toggleFavorite'
			}
		);

		return !isFavorite;
	} catch (error) {
		console.error('toggleFavorite error:', error);
		throw error;
	}
};

export const markFavoriteItem = async (service, itemId) => {
	return toggleFavoriteItem(service, itemId, false);
};

export const unmarkFavoriteItem = async (service, itemId) => {
	return toggleFavoriteItem(service, itemId, true);
};

export const markItemWatched = async (service, itemId) => {
	try {
		await service._request(
			`/Users/${service.userId}/PlayedItems/${itemId}`,
			{
				method: 'POST',
				expectJson: false,
				context: 'markWatched'
			}
		);

		return true;
	} catch (error) {
		console.error('markWatched error:', error);
		throw error;
	}
};

export const markItemUnwatched = async (service, itemId) => {
	try {
		await service._request(
			`/Users/${service.userId}/PlayedItems/${itemId}`,
			{
				method: 'DELETE',
				expectJson: false,
				context: 'markUnwatched'
			}
		);

		return false;
	} catch (error) {
		console.error('markUnwatched error:', error);
		throw error;
	}
};

export const toggleItemWatched = async (service, itemId, isWatched) => {
	if (isWatched) {
		return markItemUnwatched(service, itemId);
	}
	return markItemWatched(service, itemId);
};
