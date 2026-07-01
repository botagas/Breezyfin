import {
	normalizeNumericSetting,
	SUBTITLE_OVERLAY_FONT_SIZE_RANGE,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE
} from '../../../utils/subtitleAppearance';

const SUBTITLE_SIZE_VALUES = new Set(['small', 'medium', 'large']);
const SUBTITLE_POSITION_VALUES = new Set(['low', 'standard', 'raised']);
const SUBTITLE_BACKGROUND_VALUES = new Set(['none', 'low', 'medium', 'high']);
const SUBTITLE_WEIGHT_VALUES = new Set(['regular', 'bold', 'black']);
const SUBTITLE_TEXT_COLOR_VALUES = new Set(['white', 'warmWhite', 'yellow', 'black']);
const SUBTITLE_BORDER_STYLE_VALUES = new Set(['none', 'shadow', 'outline', 'box']);
const SUBTITLE_BORDER_COLOR_VALUES = new Set(['black', 'white', 'yellow', 'accent']);
const SUBTITLE_BORDER_STRENGTH_VALUES = new Set(['low', 'medium', 'high']);
const SUBTITLE_OUTLINE_SIZE_VALUES = new Set(['thin', 'medium', 'thick', 'extra']);
const SUBTITLE_SHADOW_DISTANCE_VALUES = new Set(['low', 'medium', 'high', 'extra']);
const SUBTITLE_SHADOW_ANGLE_VALUES = new Set(['down', 'downRight', 'downLeft', 'upRight', 'upLeft']);

export const SUBTITLE_REGION_KEYS = ['top', 'middle', 'bottom'];
export const SUBTITLE_ALIGN_KEYS = ['left', 'center', 'right'];

const normalizeSubtitleSetting = (value, allowedValues, fallback) => {
	return allowedValues.has(value) ? value : fallback;
};

export const getSubtitleOverlayAttributes = (settings = {}, controlsVisible = false) => ({
	'data-size': normalizeSubtitleSetting(settings.subtitleOverlaySize, SUBTITLE_SIZE_VALUES, 'medium'),
	'data-position': normalizeSubtitleSetting(settings.subtitleOverlayPosition, SUBTITLE_POSITION_VALUES, 'standard'),
	'data-background': normalizeSubtitleSetting(settings.subtitleOverlayBackground, SUBTITLE_BACKGROUND_VALUES, 'none'),
	'data-weight': normalizeSubtitleSetting(settings.subtitleOverlayWeight, SUBTITLE_WEIGHT_VALUES, 'bold'),
	'data-text-color': normalizeSubtitleSetting(settings.subtitleOverlayTextColor, SUBTITLE_TEXT_COLOR_VALUES, 'white'),
	'data-border-style': normalizeSubtitleSetting(settings.subtitleOverlayBorderStyle, SUBTITLE_BORDER_STYLE_VALUES, 'outline'),
	'data-border-color': normalizeSubtitleSetting(settings.subtitleOverlayBorderColor, SUBTITLE_BORDER_COLOR_VALUES, 'black'),
	'data-border-strength': normalizeSubtitleSetting(settings.subtitleOverlayBorderStrength, SUBTITLE_BORDER_STRENGTH_VALUES, 'medium'),
	'data-outline-size': normalizeSubtitleSetting(settings.subtitleOverlayOutlineSize, SUBTITLE_OUTLINE_SIZE_VALUES, 'medium'),
	'data-shadow-distance': normalizeSubtitleSetting(settings.subtitleOverlayShadowDistance, SUBTITLE_SHADOW_DISTANCE_VALUES, 'medium'),
	'data-shadow-angle': normalizeSubtitleSetting(settings.subtitleOverlayShadowAngle, SUBTITLE_SHADOW_ANGLE_VALUES, 'down'),
	'data-controls-visible': controlsVisible ? 'true' : 'false'
});

export const getSubtitleOverlayStyle = (settings = {}) => ({
	'--bf-player-subtitle-current-font-size': `${normalizeNumericSetting(
		settings.subtitleOverlayFontSizePx,
		SUBTITLE_OVERLAY_FONT_SIZE_RANGE
	)}px`,
	'--bf-player-subtitle-current-outline-size': `${normalizeNumericSetting(
		settings.subtitleOverlayOutlineSizePx,
		SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE
	)}px`
});

export const getSubtitleTextStyle = (settings = {}) => ({
	fontSize: `${normalizeNumericSetting(
		settings.subtitleOverlayFontSizePx,
		SUBTITLE_OVERLAY_FONT_SIZE_RANGE
	)}px`,
	'--bf-player-subtitle-current-outline-size': `${normalizeNumericSetting(
		settings.subtitleOverlayOutlineSizePx,
		SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE
	)}px`
});

const getCueSourceFontSize = (cue = {}) => {
	const sourceFontSize = cue.sourceFontSize || {};
	const fontSizeVh = Number(sourceFontSize.fontSizeVh);
	return Number.isFinite(fontSizeVh) && fontSizeVh > 0 ? `${fontSizeVh.toFixed(3)}vh` : '';
};

const getCueSourceFontSizeVh = (cue = {}) => {
	const sourceFontSize = cue.sourceFontSize || {};
	const fontSizeVh = Number(sourceFontSize.fontSizeVh);
	return Number.isFinite(fontSizeVh) && fontSizeVh > 0 ? fontSizeVh : null;
};

const getCueLineCount = (cue = {}) => (Array.isArray(cue.lines) ? cue.lines.length : 0);

const getCueTextLength = (cue = {}) => (
	Array.isArray(cue.lines) ? cue.lines.join(' ').length : 0
);

export const isLargeSubtitleCue = (cue = {}) => (
	getCueLineCount(cue) >= 5 ||
	getCueTextLength(cue) >= 220
);

const getLargeCueFontSize = (cue = {}) => {
	if (!isLargeSubtitleCue(cue)) return '';
	const lineCount = Math.max(1, getCueLineCount(cue));
	const sourceFontSizeVh = getCueSourceFontSizeVh(cue);
	const maxFitVh = Math.max(1.25, Math.min(2.8, 78 / (lineCount * 1.12)));
	const fallbackVh = 2.2;
	const resolvedVh = sourceFontSizeVh
		? Math.min(sourceFontSizeVh, maxFitVh)
		: Math.min(fallbackVh, maxFitVh);
	return `${resolvedVh.toFixed(3)}vh`;
};

const toPercent = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? `${numberValue.toFixed(3)}%` : '';
};

const toVh = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? `${numberValue.toFixed(3)}vh` : '';
};

const clampPercent = (value) => {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return null;
	return Math.min(100, Math.max(0, numberValue));
};

const getCueMarginStyle = (cue = {}) => {
	const sourceMargins = cue.sourceMargins || {};
	const left = toPercent(sourceMargins.leftPercent);
	const right = toPercent(sourceMargins.rightPercent);
	const vertical = toVh(sourceMargins.verticalPercent);
	const style = {};
	if (left) style.marginLeft = left;
	if (right) style.marginRight = right;
	if (left || right) {
		const leftPercent = Number(sourceMargins.leftPercent) || 0;
		const rightPercent = Number(sourceMargins.rightPercent) || 0;
		style.maxWidth = `calc(100% - ${(leftPercent + rightPercent).toFixed(3)}%)`;
	}
	if (vertical && cue.placement === 'top') {
		style.marginTop = vertical;
	}
	if (vertical && cue.placement === 'bottom') {
		style.marginBottom = vertical;
	}
	return style;
};

const getCueWrapStyle = (cue = {}) => {
	const wrapStyle = Number(cue.wrapStyle);
	if (!Number.isInteger(wrapStyle)) return {};
	if (wrapStyle === 2) {
		return {
			whiteSpace: 'pre'
		};
	}
	return {
		whiteSpace: 'pre-wrap',
		overflowWrap: wrapStyle === 1 ? 'anywhere' : 'normal'
	};
};

const CUE_TRANSFORM_LAYER_STYLE_KEYS = Object.freeze([
	'display',
	'transform',
	'transformOrigin'
]);

const getCueSourceStyle = (cue = {}) => ({
	...(cue.sourceStyle || {}),
	...(cue.activeSourceStyle || {})
});

const hasOriginTransformLayer = (cue = {}) => (
	Number.isFinite(cue?.origin?.xPercent) &&
	Number.isFinite(cue?.origin?.yPercent) &&
	Number.isFinite(cue?.absolutePosition?.xPercent) &&
	Number.isFinite(cue?.absolutePosition?.yPercent) &&
	Boolean(getCueSourceStyle(cue).transform)
);

const stripCueTransformLayerStyle = (style = {}) => {
	const textStyle = {...style};
	CUE_TRANSFORM_LAYER_STYLE_KEYS.forEach((key) => {
		delete textStyle[key];
	});
	return textStyle;
};

export const getSubtitleCueTransformLayerStyle = (cue = {}) => {
	if (!hasOriginTransformLayer(cue)) return {};
	const sourceStyle = getCueSourceStyle(cue);
	return {
		transform: sourceStyle.transform,
		transformOrigin: `${cue.origin.xPercent.toFixed(3)}% ${cue.origin.yPercent.toFixed(3)}%`
	};
};

export const getSubtitleCueTextStyle = (baseTextStyle = {}, cue = {}) => {
	const sourceFontSize = getCueSourceFontSize(cue);
	const largeCue = isLargeSubtitleCue(cue);
	const largeCueFontSize = getLargeCueFontSize(cue);
	const sourceStyle = hasOriginTransformLayer(cue)
		? stripCueTransformLayerStyle(getCueSourceStyle(cue))
		: getCueSourceStyle(cue);
	return {
		...baseTextStyle,
		...(cue.runLines || cue.drawing ? {
			background: 'transparent',
			boxShadow: 'none',
			...(cue.drawing ? {padding: 0} : {})
		} : {}),
		...sourceStyle,
		...(largeCue ? {
			lineHeight: 1.12,
			maxHeight: '86vh',
			maxWidth: '100%',
			overflow: 'hidden',
			padding: '0.08em 0.28em'
		} : {}),
		...getCueMarginStyle(cue),
		...getCueWrapStyle(cue),
		...(sourceFontSize ? {fontSize: sourceFontSize} : {}),
		...(largeCueFontSize ? {fontSize: largeCueFontSize} : {}),
		...(Number.isFinite(cue.opacity) ? {opacity: cue.opacity} : {})
	};
};

export const getSubtitleCueRunStyle = (run = {}) => (run?.style ? {...run.style} : {});

export const isDrawingSubtitleCue = (cue) => (
	Array.isArray(cue?.drawing?.paths) &&
	cue.drawing.paths.length > 0 &&
	typeof cue.drawing.viewBox?.value === 'string'
);

export const isDrawingVectorClippedSubtitleCue = (cue) => (
	isDrawingSubtitleCue(cue) &&
	cue?.clip?.type === 'drawing' &&
	typeof cue.clip.pathData === 'string' &&
	cue.clip.pathData.trim().length > 0
);

export const getSubtitleDrawingSvgStyle = (cue = {}) => {
	if (!isDrawingSubtitleCue(cue)) return {};
	const width = Number(cue.drawing.viewBox.width);
	const height = Number(cue.drawing.viewBox.height);
	const playResX = Number(cue.drawing.playResX);
	const playResY = Number(cue.drawing.playResY);
	return {
		...(Number.isFinite(width) && Number.isFinite(playResX) && playResX > 0 ? {
			width: `${Math.max(1, Math.min(100, (width / playResX) * 100)).toFixed(3)}vw`
		} : {}),
		...(Number.isFinite(height) && Number.isFinite(playResY) && playResY > 0 ? {
			height: `${Math.max(1, Math.min(100, (height / playResY) * 100)).toFixed(3)}vh`
		} : {})
	};
};

export const getSubtitleDrawingClipPath = (cue = {}) => {
	if (!isDrawingVectorClippedSubtitleCue(cue)) return null;
	const viewBox = cue.drawing.viewBox || {};
	if (cue.clip.inverted !== true) {
		return {
			d: cue.clip.pathData,
			inverted: false
		};
	}
	const x = Number(viewBox.x);
	const y = Number(viewBox.y);
	const width = Number(viewBox.width);
	const height = Number(viewBox.height);
	if (![x, y, width, height].every(Number.isFinite)) {
		return {
			d: cue.clip.pathData,
			inverted: true
		};
	}
	const right = x + width;
	const bottom = y + height;
	return {
		d: [
			`M ${x.toFixed(3)} ${y.toFixed(3)}`,
			`H ${right.toFixed(3)}`,
			`V ${bottom.toFixed(3)}`,
			`H ${x.toFixed(3)} Z`,
			cue.clip.pathData
		].join(' '),
		inverted: true
	};
};

export const isAbsoluteSubtitleCue = (cue) => (
	Number.isFinite(cue?.absolutePosition?.xPercent) &&
	Number.isFinite(cue?.absolutePosition?.yPercent)
);

export const isClippedSubtitleCue = (cue) => (
	Boolean(cue?.clip) &&
	Number.isFinite(cue.clip.leftPercent) &&
	Number.isFinite(cue.clip.topPercent) &&
	Number.isFinite(cue.clip.rightPercent) &&
	Number.isFinite(cue.clip.bottomPercent)
);

export const getSubtitleClipLayerStyle = (cue = {}) => {
	if (!isClippedSubtitleCue(cue)) return {};
	const left = clampPercent(cue.clip.leftPercent);
	const top = clampPercent(cue.clip.topPercent);
	const right = clampPercent(cue.clip.rightPercent);
	const bottom = clampPercent(cue.clip.bottomPercent);
	if ([left, top, right, bottom].some((value) => value === null)) return {};
	if (cue.clip.inverted === true) {
		const path = [
			'path(evenodd, "M0 0 H100 V100 H0 Z',
			`M${left.toFixed(3)} ${top.toFixed(3)}`,
			`H${right.toFixed(3)}`,
			`V${bottom.toFixed(3)}`,
			`H${left.toFixed(3)} Z")`
		].join(' ');
		return {
			clipPath: path,
			WebkitClipPath: path
		};
	}
	const inset = `inset(${top.toFixed(3)}% ${(100 - right).toFixed(3)}% ${(100 - bottom).toFixed(3)}% ${left.toFixed(3)}%)`;
	return {
		clipPath: inset,
		WebkitClipPath: inset
	};
};

export const groupSubtitleCuesByPlacement = (cues = []) => cues.reduce((groups, cue) => {
	if (isAbsoluteSubtitleCue(cue) || isClippedSubtitleCue(cue)) return groups;
	const region = SUBTITLE_REGION_KEYS.includes(cue?.placement) ? cue.placement : 'bottom';
	const align = SUBTITLE_ALIGN_KEYS.includes(cue?.horizontalAlign) ? cue.horizontalAlign : 'center';
	groups[region][align].push(cue);
	return groups;
}, SUBTITLE_REGION_KEYS.reduce((groups, region) => ({
	...groups,
	[region]: SUBTITLE_ALIGN_KEYS.reduce((alignGroups, align) => ({
		...alignGroups,
		[align]: []
	}), {})
}), {}));
