const ASS_TRANSFORM_STYLE_KEYS = Object.freeze([
	'display',
	'transform',
	'transformOrigin'
]);

const getRunTransformStyle = (run = {}) => {
	const style = run?.style || {};
	if (!style.transform) return null;
	return ASS_TRANSFORM_STYLE_KEYS.reduce((transformStyle, key) => ({
		...transformStyle,
		...(style[key] ? {[key]: style[key]} : {})
	}), {});
};

const areTransformStylesEqual = (left = {}, right = {}) => (
	ASS_TRANSFORM_STYLE_KEYS.every((key) => String(left[key] || '') === String(right[key] || ''))
);

export const getSharedAssRunTransformStyle = (lineRuns = []) => {
	let sharedTransformStyle = null;
	let runCount = 0;
	for (const line of lineRuns) {
		for (const run of line || []) {
			runCount += 1;
			const transformStyle = getRunTransformStyle(run);
			if (!transformStyle) return null;
			if (!sharedTransformStyle) {
				sharedTransformStyle = transformStyle;
			} else if (!areTransformStylesEqual(sharedTransformStyle, transformStyle)) {
				return null;
			}
		}
	}
	return runCount > 0 ? sharedTransformStyle : null;
};

export const stripAssRunTransformStyle = (lineRuns = []) => (
	lineRuns.map((line) => (
		(line || []).map((run) => {
			const style = {...(run?.style || {})};
			ASS_TRANSFORM_STYLE_KEYS.forEach((key) => {
				delete style[key];
			});
			return {
				...run,
				style
			};
		})
	))
);
