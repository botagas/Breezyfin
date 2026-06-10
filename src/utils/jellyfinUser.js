export const getJellyfinUsername = async (jellyfinService) => {
	if (jellyfinService?.username) return jellyfinService.username;
	try {
		const user = await jellyfinService.getCurrentUser();
		return user?.Name || '';
	} catch (_) {
		return '';
	}
};
