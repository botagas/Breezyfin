export const PERFORMANCE_MODES = Object.freeze({
	NORMAL: 'normal',
	PERFORMANCE: 'performance',
	PERFORMANCE_PLUS: 'performance-plus'
});

export const getPerformanceMode = (settings = {}) => {
	if (settings.disableAllAnimations === true) return PERFORMANCE_MODES.PERFORMANCE_PLUS;
	if (settings.disableAnimations === true) return PERFORMANCE_MODES.PERFORMANCE;
	return PERFORMANCE_MODES.NORMAL;
};

export const getVirtualGridOverhang = (mode) => (
	mode === PERFORMANCE_MODES.NORMAL ? 2 : 1
);

export const getMediaBackdropProfile = (mode) => {
	if (mode === PERFORMANCE_MODES.PERFORMANCE_PLUS) {
		return {width: 640, quality: 55, blur: undefined};
	}
	if (mode === PERFORMANCE_MODES.PERFORMANCE) {
		return {width: 720, quality: 62, blur: 8};
	}
	return {width: 960, quality: 70, blur: 20};
};
