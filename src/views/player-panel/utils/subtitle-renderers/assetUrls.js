export const buildAppAssetUrl = (assetPath) => {
	const normalizedPath = String(assetPath || '').replace(/^\/+/u, '');
	if (typeof document === 'undefined' || !document.baseURI) return normalizedPath;
	try {
		return new URL(normalizedPath, document.baseURI).href;
	} catch (error) {
		return normalizedPath;
	}
};
