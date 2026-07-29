import {
	normalizeNumericSetting,
	SUBTITLE_OVERLAY_FONT_SIZE_RANGE,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE
} from '../../../utils/subtitleAppearance';
import {
	getAssCoordinatePlane,
	getAssStageLengthPx,
	getAssStagePercent
} from './subtitleRendererAssStage';

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
const ASS_VIEWPORT_LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)vh$/i;
const ASS_BORDER_LENGTH_STYLE_KEYS = new Set([
	'--bf-player-subtitle-current-outline-size',
	'--bf-player-subtitle-current-shadow-distance',
	'--bf-player-subtitle-current-shadow-x',
	'--bf-player-subtitle-current-shadow-y',
	'--bf-player-subtitle-current-shadow-blur'
]);

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

const getCueSourceFontSize = (cue = {}, stageGeometry = {}) => {
	const sourceFontSize = cue.sourceFontSize || {};
	const sourceSize = Number(sourceFontSize.size);
	const stageSize = getAssStageLengthPx(sourceSize, 'y', cue, stageGeometry);
	if (Number.isFinite(stageSize) && stageSize > 0) return `${stageSize.toFixed(3)}px`;
	const fontSizeVh = Number(sourceFontSize.fontSizeVh);
	const stageHeight = Number(stageGeometry.height);
	return Number.isFinite(fontSizeVh) && fontSizeVh > 0 && Number.isFinite(stageHeight)
		? `${((fontSizeVh / 100) * stageHeight).toFixed(3)}px`
		: '';
};

const getCueLineCount = (cue = {}) => (Array.isArray(cue.lines) ? cue.lines.length : 0);

const getCueTextLength = (cue = {}) => (
	Array.isArray(cue.lines) ? cue.lines.join(' ').length : 0
);

export const isLargeSubtitleCue = (cue = {}) => (
	getCueLineCount(cue) >= 5 ||
	getCueTextLength(cue) >= 220
);

const clampPercent = (value) => {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return null;
	return Math.min(100, Math.max(0, numberValue));
};

export const getSubtitleAbsolutePositionStyle = (cue = {}, stageGeometry = {}) => {
	const authoredX = getAssStagePercent(cue.absolutePosition?.x, 'x', cue, stageGeometry) ?? cue.absolutePosition?.xPercent;
	const authoredY = getAssStagePercent(cue.absolutePosition?.y, 'y', cue, stageGeometry) ?? cue.absolutePosition?.yPercent;
	const xPercent = Number(authoredX);
	const yPercent = Number(authoredY);
	if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) return {};
	return {
		'--bf-player-subtitle-absolute-x': `${xPercent.toFixed(3)}%`,
		'--bf-player-subtitle-absolute-y': `${yPercent.toFixed(3)}%`,
		'--bf-player-subtitle-absolute-max-width': 'none',
		'--bf-player-subtitle-absolute-max-height': 'none'
	};
};

const getCueMarginStyle = (cue = {}, stageGeometry = {}) => {
	if (cue.absolutePosition || cue.move) return {};
	const sourceMargins = cue.sourceMargins || {};
	const leftPx = getAssStageLengthPx(sourceMargins.left, 'x', cue, stageGeometry);
	const rightPx = getAssStageLengthPx(sourceMargins.right, 'x', cue, stageGeometry);
	const leftPercent = Number(sourceMargins.leftPercent);
	const rightPercent = Number(sourceMargins.rightPercent);
	const left = Number.isFinite(leftPx) && leftPx > 0
		? `${leftPx.toFixed(3)}px`
		: (Number.isFinite(leftPercent) && leftPercent > 0 ? `${leftPercent.toFixed(3)}%` : '');
	const right = Number.isFinite(rightPx) && rightPx > 0
		? `${rightPx.toFixed(3)}px`
		: (Number.isFinite(rightPercent) && rightPercent > 0 ? `${rightPercent.toFixed(3)}%` : '');
	const verticalPx = getAssStageLengthPx(sourceMargins.vertical, 'y', cue, stageGeometry);
	const fallbackVerticalPercent = Number(sourceMargins.verticalPercent);
	const fallbackStageHeight = Number(stageGeometry.height) || 1080;
	const resolvedVerticalPx = Number.isFinite(verticalPx)
		? verticalPx
		: ((Number.isFinite(fallbackVerticalPercent) ? fallbackVerticalPercent : 0) / 100) * fallbackStageHeight;
	const vertical = resolvedVerticalPx > 0 ? `${resolvedVerticalPx.toFixed(3)}px` : '';
	const style = {};
	if (left) style.marginLeft = left;
	if (right) style.marginRight = right;
	if (left || right) {
		style.maxWidth = Number.isFinite(leftPx) || Number.isFinite(rightPx)
			? `calc(100% - ${((leftPx || 0) + (rightPx || 0)).toFixed(3)}px)`
			: `calc(100% - ${((leftPercent || 0) + (rightPercent || 0)).toFixed(3)}%)`;
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

const convertStageRelativeStyle = (style = {}, stageGeometry = {}, cue = {}) => {
	const stageHeight = Number(stageGeometry.height) || 1080;
	const plane = getAssCoordinatePlane(cue, stageGeometry);
	return Object.entries(style).reduce((nextStyle, [key, value]) => {
		const match = typeof value === 'string' ? value.trim().match(ASS_VIEWPORT_LENGTH_PATTERN) : null;
		if (!match) {
			nextStyle[key] = value;
			return nextStyle;
		}
		const authoredVh = Number(match[1]);
		const useUnscaledBorder = cue.scriptGeometry?.scaledBorderAndShadow === false && ASS_BORDER_LENGTH_STYLE_KEYS.has(key);
		const playResY = Number(cue.scriptGeometry?.playResY) || Number(cue.sourceFontSize?.playResY) || 288;
		nextStyle[key] = useUnscaledBorder
			? `${(((authoredVh / 100) * playResY) * plane.layoutScaleY).toFixed(3)}px`
			: `${((authoredVh / 100) * stageHeight).toFixed(3)}px`;
		return nextStyle;
	}, {});
};

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

export const getSubtitleCueTransformLayerStyle = (cue = {}, stageGeometry = {}) => {
	if (!hasOriginTransformLayer(cue)) return {};
	const sourceStyle = getCueSourceStyle(cue);
	const originX = getAssStagePercent(cue.origin?.x, 'x', cue, stageGeometry) ?? cue.origin.xPercent;
	const originY = getAssStagePercent(cue.origin?.y, 'y', cue, stageGeometry) ?? cue.origin.yPercent;
	return {
		transform: sourceStyle.transform,
		transformOrigin: `${originX.toFixed(3)}% ${originY.toFixed(3)}%`
	};
};

export const getSubtitleCueTextStyle = (baseTextStyle = {}, cue = {}, stageGeometry = {}) => {
	const sourceFontSize = getCueSourceFontSize(cue, stageGeometry);
	const largeCue = isLargeSubtitleCue(cue);
	const sourceStyle = hasOriginTransformLayer(cue)
		? stripCueTransformLayerStyle(convertStageRelativeStyle(getCueSourceStyle(cue), stageGeometry, cue))
		: convertStageRelativeStyle(getCueSourceStyle(cue), stageGeometry, cue);
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
			maxWidth: '100%',
			padding: '0.08em 0.28em'
		} : {}),
		...getCueMarginStyle(cue, stageGeometry),
		...getCueWrapStyle(cue),
		...(sourceFontSize ? {fontSize: sourceFontSize} : {}),
		...(Number.isFinite(cue.opacity) ? {opacity: cue.opacity} : {})
	};
};

export const getSubtitleCueRunStyle = (run = {}, stageGeometry = {}, cue = {}) => {
	if (!run?.style) return {};
	return convertStageRelativeStyle(run.style, stageGeometry, cue);
};

const hasPositiveRunLength = (style = {}, property) => {
	const value = Number.parseFloat(style[property]);
	return Number.isFinite(value) && Math.abs(value) > 0.0001;
};

export const getSubtitleCueRunEffects = (run = {}) => {
	const style = run?.style || {};
	const borderStyle = Number(style['--bf-player-subtitle-source-border-style']);
	const usesOutlineBorder = !Number.isFinite(borderStyle) || borderStyle === 1;
	const authored = [
		'--bf-player-subtitle-source-border-style',
		'--bf-player-subtitle-current-outline-size',
		'--bf-player-subtitle-current-shadow-distance',
		'--bf-player-subtitle-current-shadow-x',
		'--bf-player-subtitle-current-shadow-y'
	].some((property) => Object.prototype.hasOwnProperty.call(style, property));
	return {
		authored,
		outline: usesOutlineBorder && hasPositiveRunLength(
			style,
			'--bf-player-subtitle-current-outline-size'
		),
		shadow: usesOutlineBorder && [
			'--bf-player-subtitle-current-shadow-distance',
			'--bf-player-subtitle-current-shadow-x',
			'--bf-player-subtitle-current-shadow-y'
		].some((property) => hasPositiveRunLength(style, property))
	};
};

export const isDrawingSubtitleCue = (cue) => (
	Array.isArray(cue?.drawing?.paths) &&
	cue.drawing.paths.length > 0 &&
	typeof cue.drawing.viewBox?.value === 'string'
);

export const getSubtitleDrawingSvgStyle = (cue = {}, stageGeometry = {}) => {
	if (!isDrawingSubtitleCue(cue)) return {};
	const width = Number(cue.drawing.viewBox.width);
	const height = Number(cue.drawing.viewBox.height);
	const plane = getAssCoordinatePlane(cue, stageGeometry);
	return {
		...(Number.isFinite(width) && plane.scaleX > 0 ? {
			width: `${Math.max(1, width * plane.scaleX).toFixed(3)}px`
		} : {}),
		...(Number.isFinite(height) && plane.scaleY > 0 ? {
			height: `${Math.max(1, height * plane.scaleY).toFixed(3)}px`
		} : {})
	};
};

export const isAbsoluteSubtitleCue = (cue) => (
	Number.isFinite(cue?.absolutePosition?.xPercent) &&
	Number.isFinite(cue?.absolutePosition?.yPercent)
);

export const isClippedSubtitleCue = (cue) => (
	Boolean(cue?.clip) && (
		(
			Number.isFinite(cue.clip.leftPercent) &&
			Number.isFinite(cue.clip.topPercent) &&
			Number.isFinite(cue.clip.rightPercent) &&
			Number.isFinite(cue.clip.bottomPercent)
		) || (
			cue.clip.type === 'drawing' &&
			typeof cue.clip.pathData === 'string' &&
			cue.clip.pathData.trim().length > 0
		)
	)
);

export const scaleAssClipPathData = (pathData, scaleX, scaleY, offsetX = 0, offsetY = 0) => {
	let coordinateIndex = 0;
	return String(pathData || '').replace(/-?\d+(?:\.\d+)?/g, (value) => {
		const numericValue = Number(value);
		const horizontal = coordinateIndex % 2 === 0;
		const scale = horizontal ? scaleX : scaleY;
		const offset = horizontal ? offsetX : offsetY;
		coordinateIndex += 1;
		return Number.isFinite(numericValue) && Number.isFinite(scale)
			? ((numericValue * scale) + (Number(offset) || 0)).toFixed(3)
			: value;
	});
};

export const getSubtitleClipLayerStyle = (cue = {}, stageGeometry = {}) => {
	if (!isClippedSubtitleCue(cue)) return {};
	if (cue.clip.type === 'drawing') {
		const plane = getAssCoordinatePlane(cue, stageGeometry);
		const pathData = scaleAssClipPathData(
			cue.clip.pathData,
			plane.scaleX,
			plane.scaleY,
			plane.offsetX,
			plane.offsetY
		);
		const stageWidth = Number(stageGeometry.width) || plane.width * plane.scaleX;
		const stageHeight = Number(stageGeometry.height) || plane.height * plane.scaleY;
		const path = cue.clip.inverted === true
			? `path(evenodd, "M0 0 H${stageWidth.toFixed(3)} V${stageHeight.toFixed(3)} H0 Z ${pathData}")`
			: `path(evenodd, "${pathData}")`;
		return {
			clipPath: path,
			WebkitClipPath: path
		};
	}
	const left = clampPercent(getAssStagePercent(cue.clip.x1, 'x', cue, stageGeometry) ?? cue.clip.leftPercent);
	const top = clampPercent(getAssStagePercent(cue.clip.y1, 'y', cue, stageGeometry) ?? cue.clip.topPercent);
	const right = clampPercent(getAssStagePercent(cue.clip.x2, 'x', cue, stageGeometry) ?? cue.clip.rightPercent);
	const bottom = clampPercent(getAssStagePercent(cue.clip.y2, 'y', cue, stageGeometry) ?? cue.clip.bottomPercent);
	if ([left, top, right, bottom].some((value) => value === null)) return {};
	if (cue.clip.inverted === true) {
		const path = `polygon(evenodd, ${left.toFixed(3)}% ${top.toFixed(3)}%, ` +
			`${left.toFixed(3)}% ${bottom.toFixed(3)}%, ${right.toFixed(3)}% ${bottom.toFixed(3)}%, ` +
			`${right.toFixed(3)}% ${top.toFixed(3)}%, ${left.toFixed(3)}% ${top.toFixed(3)}%, ` +
			'0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%)';
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

export const groupSubtitleCuesByLayer = (cues = []) => {
	const layers = new Map();
	for (const cue of cues) {
		const numericLayer = Number(cue?.layer);
		const layer = Number.isFinite(numericLayer) ? numericLayer : 0;
		if (!layers.has(layer)) layers.set(layer, []);
		layers.get(layer).push(cue);
	}
	return Array.from(layers.entries())
		.sort(([leftLayer], [rightLayer]) => leftLayer - rightLayer)
		.map(([layer, layerCues]) => ({layer, cues: layerCues}));
};
