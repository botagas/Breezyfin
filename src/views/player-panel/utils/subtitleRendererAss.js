import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	SUBTITLE_PLACEMENT_BOTTOM,
	SUBTITLE_PLACEMENT_TOP,
	getAssAlignmentFromOverrideBlock,
	getHorizontalAlignFromAssAlignment,
	getPlacementFromAssAlignment,
	normalizeAssAlignmentNumber
} from './subtitleRendererAssAlignment';
import {
	applyAssAlphaToColor,
	normalizeAssColorHex
} from './subtitleRendererAssColors';
import {buildAssClipFromBlock} from './subtitleRendererAssClip';
import {
	DEFAULT_ASS_PLAY_RES_X,
	DEFAULT_ASS_PLAY_RES_Y,
	buildAssScaledValue,
	normalizeAssPlayResValue
} from './subtitleRendererAssDimensions';
import {
	buildAssDrawingFromRaw,
	getAssDrawingModeFromBlock
} from './subtitleRendererAssDrawing';
import {
	buildAssFontSizeOverride,
	buildAssSourceFontSize
} from './subtitleRendererAssFontSize';
import {
	getSharedAssRunTransformStyle,
	stripAssRunTransformStyle
} from './subtitleRendererAssOrigin';
import {
	buildAssPositionFromCoordinates
} from './subtitleRendererAssPosition';
import {
	buildAssKaraokeFromBlock,
	decorateAssKaraokeRuns
} from './subtitleRendererAssKaraoke';
import {
	applyAssTransformsAtTicks,
	parseAssTransforms,
	stripAssTransformBlocks
} from './subtitleRendererAssTransform';

const ASS_OVERRIDE_BLOCK_PATTERN = /\{\\[^}]*\}/g;
const ASS_POSITION_PATTERN = /\\pos\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i;
const ASS_ORIGIN_PATTERN = /\\org\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i;
const ASS_MOVE_PATTERN = /\\move\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?))?\s*\)/i;
const ASS_FONT_SIZE_PATTERN = /\\fs\s*([+-]?[0-9]+(?:\.\d+)?)/i;
const ASS_WRAP_STYLE_PATTERN = /\\q\s*([0-3])/i;
const ASS_FADE_PATTERN = /\\fad\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/i;
const ASS_COMPLEX_FADE_PATTERN = /\\fade\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/i;
const ASS_FONT_NAME_PATTERN = /\\fn\s*([^\\}]+)/i;
const ASS_BORDER_PATTERN = /\\bord\s*([0-9]+(?:\.\d+)?)/i;
const ASS_X_BORDER_PATTERN = /\\xbord\s*([0-9]+(?:\.\d+)?)/i;
const ASS_Y_BORDER_PATTERN = /\\ybord\s*([0-9]+(?:\.\d+)?)/i;
const ASS_SHADOW_PATTERN = /\\shad\s*([0-9]+(?:\.\d+)?)/i;
const ASS_X_SHADOW_PATTERN = /\\xshad\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_Y_SHADOW_PATTERN = /\\yshad\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_BLUR_PATTERN = /\\blur\s*([0-9]+(?:\.\d+)?)/i;
const ASS_BE_PATTERN = /\\be\s*([0-9]+(?:\.\d+)?)/i;
const ASS_SCALE_X_PATTERN = /\\fscx\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_SCALE_Y_PATTERN = /\\fscy\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_SPACING_PATTERN = /\\fsp\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_ROTATION_X_PATTERN = /\\frx\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_ROTATION_Y_PATTERN = /\\fry\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_ROTATION_Z_PATTERN = /\\(?:frz|fr)\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_SKEW_X_PATTERN = /\\fax\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_SKEW_Y_PATTERN = /\\fay\s*(-?[0-9]+(?:\.\d+)?)/i;
const ASS_RESET_PATTERN = /\\r([^\\}]*)/i;
const ASS_COLOR_TAG_PATTERN = /\\([1-4]?c)\s*(&H[0-9a-f]+&?)/ig;
const ASS_ALPHA_TAG_PATTERN = /\\([1-4]?a|alpha)\s*(&H[0-9a-f]+&?)/ig;
const ASS_LINE_BREAK_PATTERN = /\\[Nn]/g;
const ASS_TIME_PATTERN = /(\d+):(\d{2}):(\d{2})[.](\d{1,2})/;
const ASS_SCRIPT_INFO_SECTION = 'script info';
const ASS_STYLE_SECTION_NAMES = new Set(['v4+ styles', 'v4 styles']);
const ASS_STYLE_NUMERIC_TRUE_VALUES = new Set(['-1', '1']);

export {
	SUBTITLE_ALIGN_CENTER,
	SUBTITLE_ALIGN_LEFT,
	SUBTITLE_ALIGN_RIGHT,
	SUBTITLE_PLACEMENT_BOTTOM,
	SUBTITLE_PLACEMENT_MIDDLE,
	SUBTITLE_PLACEMENT_TOP,
	getHorizontalAlignFromAlignment,
	getHorizontalAlignFromAssAlignment,
	getPlacementFromAlignment,
	getPlacementFromAssAlignment
} from './subtitleRendererAssAlignment';

export const normalizeAssNumber = (value) => {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const numberValue = Number(raw);
	return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeAssMarginValue = (value) => {
	const numberValue = normalizeAssNumber(value);
	return numberValue !== null && numberValue >= 0 ? numberValue : null;
};

export const normalizeAssWrapStyle = (value) => {
	const numberValue = normalizeAssNumber(value);
	return Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 3 ? numberValue : null;
};

const normalizeAssBoolean = (value) => {
	const normalized = String(value ?? '').trim();
	return ASS_STYLE_NUMERIC_TRUE_VALUES.has(normalized);
};

const sanitizeAssFontFamily = (value) => {
	const fontName = String(value || '')
		.replace(/[\\'"]/g, '')
		.replace(/[^\w\s.-]/g, '')
		.trim()
		.slice(0, 80);
	return fontName ? `'${fontName}', sans-serif` : '';
};

const buildAssAbsolutePosition = (positionMatch, playResX, playResY) => {
	if (!positionMatch) return null;
	const x = Number(positionMatch[1]);
	const y = Number(positionMatch[2]);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return buildAssPositionFromCoordinates(x, y, playResX, playResY);
};

const buildAssOrigin = (originMatch, playResX, playResY) => {
	if (!originMatch) return null;
	const x = Number(originMatch[1]);
	const y = Number(originMatch[2]);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return buildAssPositionFromCoordinates(x, y, playResX, playResY);
};

const buildAssMove = (moveMatch, playResX, playResY) => {
	if (!moveMatch) return null;
	const startX = Number(moveMatch[1]);
	const startY = Number(moveMatch[2]);
	const endX = Number(moveMatch[3]);
	const endY = Number(moveMatch[4]);
	const startMs = Number(moveMatch[5]);
	const endMs = Number(moveMatch[6]);
	if (![startX, startY, endX, endY].every(Number.isFinite)) return null;
	const startPosition = buildAssPositionFromCoordinates(startX, startY, playResX, playResY);
	const endPosition = buildAssPositionFromCoordinates(endX, endY, playResX, playResY);
	if (!startPosition || !endPosition) return null;
	return {
		startPosition,
		endPosition,
		startMs: Number.isFinite(startMs) ? Math.max(0, startMs) : 0,
		endMs: Number.isFinite(endMs) ? Math.max(0, endMs) : null
	};
};

export const buildAssSourceMargins = ({marginL, marginR, marginV, playResX, playResY} = {}) => {
	const left = normalizeAssMarginValue(marginL);
	const right = normalizeAssMarginValue(marginR);
	const vertical = normalizeAssMarginValue(marginV);
	if (!left && !right && !vertical) return null;
	const resolvedPlayResX = normalizeAssPlayResValue(playResX, DEFAULT_ASS_PLAY_RES_X);
	const resolvedPlayResY = normalizeAssPlayResValue(playResY, DEFAULT_ASS_PLAY_RES_Y);
	return {
		left: left || 0,
		right: right || 0,
		vertical: vertical || 0,
		playResX: resolvedPlayResX,
		playResY: resolvedPlayResY,
		leftPercent: ((left || 0) / resolvedPlayResX) * 100,
		rightPercent: ((right || 0) / resolvedPlayResX) * 100,
		verticalPercent: ((vertical || 0) / resolvedPlayResY) * 100
	};
};

export {buildAssSourceFontSize} from './subtitleRendererAssFontSize';

const buildAssFade = (fadeMatch) => {
	if (!fadeMatch) return null;
	const fadeInMs = Number(fadeMatch[1]);
	const fadeOutMs = Number(fadeMatch[2]);
	if (!Number.isFinite(fadeInMs) && !Number.isFinite(fadeOutMs)) return null;
	return {
		fadeInMs: Number.isFinite(fadeInMs) ? Math.max(0, fadeInMs) : 0,
		fadeOutMs: Number.isFinite(fadeOutMs) ? Math.max(0, fadeOutMs) : 0
	};
};

const buildAssComplexFade = (fadeMatch) => {
	if (!fadeMatch) return null;
	const values = fadeMatch.slice(1).map((value) => Number(value));
	if (!values.every(Number.isFinite)) return null;
	const [alpha1, alpha2, alpha3, time1, time2, time3, time4] = values;
	return {
		alpha1: Math.max(0, Math.min(255, alpha1)),
		alpha2: Math.max(0, Math.min(255, alpha2)),
		alpha3: Math.max(0, Math.min(255, alpha3)),
		time1Ms: Math.max(0, time1),
		time2Ms: Math.max(0, time2),
		time3Ms: Math.max(0, time3),
		time4Ms: Math.max(0, time4)
	};
};

const buildAssTransformStyle = (state = {}) => {
	const transforms = [];
	const scaleX = Number(state.scaleX);
	const scaleY = Number(state.scaleY);
	const rotationX = Number(state.rotationX);
	const rotationY = Number(state.rotationY);
	const rotationZ = Number(state.rotationZ);
	const skewX = Number(state.skewX);
	const skewY = Number(state.skewY);
	if (Number.isFinite(scaleX) && scaleX > 0 && scaleX !== 100) {
		transforms.push(`scaleX(${(scaleX / 100).toFixed(3)})`);
	}
	if (Number.isFinite(scaleY) && scaleY > 0 && scaleY !== 100) {
		transforms.push(`scaleY(${(scaleY / 100).toFixed(3)})`);
	}
	if (Number.isFinite(rotationX) && rotationX !== 0) {
		transforms.push(`rotateX(${rotationX.toFixed(3)}deg)`);
	}
	if (Number.isFinite(rotationY) && rotationY !== 0) {
		transforms.push(`rotateY(${rotationY.toFixed(3)}deg)`);
	}
	if (Number.isFinite(rotationZ) && rotationZ !== 0) {
		transforms.push(`rotate(${rotationZ.toFixed(3)}deg)`);
	}
	if (Number.isFinite(skewX) && skewX !== 0) {
		transforms.push(`skewX(${Math.atan(skewX).toFixed(3)}rad)`);
	}
	if (Number.isFinite(skewY) && skewY !== 0) {
		transforms.push(`skewY(${Math.atan(skewY).toFixed(3)}rad)`);
	}
	return transforms.join(' ');
};

const getAssStyleObjectFromState = (state = {}) => {
	const transform = buildAssTransformStyle(state);
	return {
		...(state.fontFamily ? {fontFamily: state.fontFamily} : {}),
		...(state.fontSize ? {fontSize: state.fontSize} : {}),
		...(state.textColor ? {color: state.textColor} : {}),
		...(state.outlineColor ? {'--bf-player-subtitle-current-border-color': state.outlineColor} : {}),
		...(state.shadowColor && !state.outlineColor ? {'--bf-player-subtitle-current-border-color': state.shadowColor} : {}),
		...(state.bold ? {fontWeight: 700} : {}),
		...(state.italic ? {fontStyle: 'italic'} : {}),
		...(state.underline || state.strikeOut ? {
			textDecoration: [
				state.underline ? 'underline' : '',
				state.strikeOut ? 'line-through' : ''
			].filter(Boolean).join(' ')
		} : {}),
		...(state.borderStyle ? {'--bf-player-subtitle-source-border-style': state.borderStyle} : {}),
		...(state.outline ? {'--bf-player-subtitle-current-outline-size': `${state.outline.valueVh.toFixed(3)}vh`} : {}),
		...(state.shadow ? {'--bf-player-subtitle-current-shadow-distance': `${state.shadow.valueVh.toFixed(3)}vh`} : {}),
		...(state.shadowX ? {'--bf-player-subtitle-current-shadow-x': `${state.shadowX.valueVh.toFixed(3)}vh`} : {}),
		...(state.shadowY ? {'--bf-player-subtitle-current-shadow-y': `${state.shadowY.valueVh.toFixed(3)}vh`} : {}),
		...(state.blur ? {'--bf-player-subtitle-current-shadow-blur': `${state.blur.valueVh.toFixed(3)}vh`} : {}),
		...(state.letterSpacing ? {letterSpacing: `${state.letterSpacing.valueVh.toFixed(3)}vh`} : {}),
		...(transform ? {
			display: 'inline-block',
			transform,
			transformOrigin: 'center center'
		} : {}),
		...(state.borderStyle === 3 && state.shadowColor ? {background: state.shadowColor} : {})
	};
};

const getAssStyle = (styles, styleName) => {
	if (!(styles instanceof Map)) return null;
	const normalizedName = String(styleName || '').trim().toLowerCase();
	return styles.get(normalizedName) || styles.get('') || null;
};

export const getPlacementFromPosition = (value) => {
	if (!Number.isFinite(value)) return null;
	if (value <= 25) return SUBTITLE_PLACEMENT_TOP;
	return SUBTITLE_PLACEMENT_BOTTOM;
};

const buildAssInlineFormattingReplacement = (block) => {
	let replacement = '';
	if (/\\b1\b/i.test(block)) replacement += '<b>';
	if (/\\b0\b/i.test(block)) replacement += '</b>';
	if (/\\i1\b/i.test(block)) replacement += '<i>';
	if (/\\i0\b/i.test(block)) replacement += '</i>';
	if (/\\u1\b/i.test(block)) replacement += '<u>';
	if (/\\u0\b/i.test(block)) replacement += '</u>';
	return replacement;
};

const buildAssStyleState = (sourceStyle = {}, playResY = DEFAULT_ASS_PLAY_RES_Y) => {
	const style = sourceStyle || {};
	const fontSize = style.fontSize ? buildAssSourceFontSize(style.fontSize, playResY) : null;
	return {
		...(style.fontName ? {fontFamily: sanitizeAssFontFamily(style.fontName)} : {}),
		...(fontSize ? {
			fontSize: `${fontSize.fontSizeVh.toFixed(3)}vh`,
			fontSizeValue: fontSize.size
		} : {}),
		...(style.primaryColor ? {textColor: style.primaryColor} : {}),
		...(style.secondaryColor ? {secondaryColor: style.secondaryColor} : {}),
		...(style.outlineColor ? {outlineColor: style.outlineColor} : {}),
		...(style.backColor ? {shadowColor: style.backColor} : {}),
		...(style.bold ? {bold: true} : {}),
		...(style.italic ? {italic: true} : {}),
		...(style.underline ? {underline: true} : {}),
		...(style.strikeOut ? {strikeOut: true} : {}),
		...(style.borderStyle ? {borderStyle: style.borderStyle} : {}),
		...(style.outline !== null && style.outline !== undefined ? {
			outline: buildAssScaledValue(style.outline, playResY)
		} : {}),
		...(style.shadow !== null && style.shadow !== undefined ? {
			shadow: buildAssScaledValue(style.shadow, playResY)
		} : {}),
		...(style.scaleX !== null && style.scaleX !== undefined ? {scaleX: style.scaleX} : {}),
		...(style.scaleY !== null && style.scaleY !== undefined ? {scaleY: style.scaleY} : {}),
		...(style.spacing !== null && style.spacing !== undefined ? {
			letterSpacing: buildAssScaledValue(style.spacing, playResY)
		} : {}),
		...(style.angle !== null && style.angle !== undefined ? {rotationZ: style.angle} : {})
	};
};

const getAssResetStyleName = (block) => {
	const match = String(block || '').match(ASS_RESET_PATTERN);
	if (!match) return null;
	return String(match[1] || '').trim();
};

const applyAssOverrideBlockToState = (block, state, playResY, baseState = {}, resolveStyleState = null) => {
	const nextState = {...state};
	const resetStyleName = getAssResetStyleName(block);
	if (resetStyleName !== null) {
		const resetState = typeof resolveStyleState === 'function'
			? resolveStyleState(resetStyleName)
			: null;
		Object.keys(nextState).forEach((key) => {
			delete nextState[key];
		});
		Object.assign(nextState, resetState || baseState || {});
	}
	if (/\\b1\b/i.test(block)) nextState.bold = true;
	if (/\\b0\b/i.test(block)) nextState.bold = false;
	if (/\\i1\b/i.test(block)) nextState.italic = true;
	if (/\\i0\b/i.test(block)) nextState.italic = false;
	if (/\\u1\b/i.test(block)) nextState.underline = true;
	if (/\\u0\b/i.test(block)) nextState.underline = false;
	if (/\\s1\b/i.test(block)) nextState.strikeOut = true;
	if (/\\s0\b/i.test(block)) nextState.strikeOut = false;
	const fontNameMatch = block.match(ASS_FONT_NAME_PATTERN);
	if (fontNameMatch) {
		nextState.fontFamily = sanitizeAssFontFamily(fontNameMatch[1]);
	}
	const fontSizeMatch = block.match(ASS_FONT_SIZE_PATTERN);
	if (fontSizeMatch) {
		const sourceFontSize = buildAssFontSizeOverride(fontSizeMatch[1], playResY, nextState.fontSizeValue);
		if (sourceFontSize) {
			nextState.fontSize = `${sourceFontSize.fontSizeVh.toFixed(3)}vh`;
			nextState.fontSizeValue = sourceFontSize.size;
		}
	}
	const borderMatch = block.match(ASS_BORDER_PATTERN);
	if (borderMatch) {
		nextState.outline = buildAssScaledValue(borderMatch[1], playResY);
	}
	const xBorderMatch = block.match(ASS_X_BORDER_PATTERN);
	const yBorderMatch = block.match(ASS_Y_BORDER_PATTERN);
	if (xBorderMatch || yBorderMatch) {
		nextState.outline = buildAssScaledValue(xBorderMatch?.[1] || yBorderMatch?.[1], playResY);
	}
	const shadowMatch = block.match(ASS_SHADOW_PATTERN);
	if (shadowMatch) {
		nextState.shadow = buildAssScaledValue(shadowMatch[1], playResY);
	}
	const xShadowMatch = block.match(ASS_X_SHADOW_PATTERN);
	if (xShadowMatch) {
		nextState.shadowX = buildAssScaledValue(xShadowMatch[1], playResY);
	}
	const yShadowMatch = block.match(ASS_Y_SHADOW_PATTERN);
	if (yShadowMatch) {
		nextState.shadowY = buildAssScaledValue(yShadowMatch[1], playResY);
	}
	const blurMatch = block.match(ASS_BLUR_PATTERN);
	if (blurMatch) {
		nextState.blur = buildAssScaledValue(blurMatch[1], playResY);
	}
	const beMatch = block.match(ASS_BE_PATTERN);
	if (beMatch && !blurMatch) {
		nextState.blur = buildAssScaledValue(beMatch[1], playResY);
	}
	const scaleXMatch = block.match(ASS_SCALE_X_PATTERN);
	if (scaleXMatch) {
		nextState.scaleX = Number(scaleXMatch[1]);
	}
	const scaleYMatch = block.match(ASS_SCALE_Y_PATTERN);
	if (scaleYMatch) {
		nextState.scaleY = Number(scaleYMatch[1]);
	}
	const spacingMatch = block.match(ASS_SPACING_PATTERN);
	if (spacingMatch) {
		nextState.letterSpacing = buildAssScaledValue(spacingMatch[1], playResY);
	}
	const rotationXMatch = block.match(ASS_ROTATION_X_PATTERN);
	if (rotationXMatch) {
		nextState.rotationX = Number(rotationXMatch[1]);
	}
	const rotationYMatch = block.match(ASS_ROTATION_Y_PATTERN);
	if (rotationYMatch) {
		nextState.rotationY = Number(rotationYMatch[1]);
	}
	const rotationZMatch = block.match(ASS_ROTATION_Z_PATTERN);
	if (rotationZMatch) {
		nextState.rotationZ = Number(rotationZMatch[1]);
	}
	const skewXMatch = block.match(ASS_SKEW_X_PATTERN);
	if (skewXMatch) {
		nextState.skewX = Number(skewXMatch[1]);
	}
	const skewYMatch = block.match(ASS_SKEW_Y_PATTERN);
	if (skewYMatch) {
		nextState.skewY = Number(skewYMatch[1]);
	}
	for (const colorMatch of block.matchAll(ASS_COLOR_TAG_PATTERN)) {
		const color = normalizeAssColorHex(colorMatch[2]);
		if (!color) continue;
		const colorTarget = String(colorMatch[1] || '').toLowerCase();
		if (colorTarget === '2c') nextState.secondaryColor = color;
		else if (colorTarget === '3c') nextState.outlineColor = color;
		else if (colorTarget === '4c') nextState.shadowColor = color;
		else nextState.textColor = color;
	}
	for (const alphaMatch of block.matchAll(ASS_ALPHA_TAG_PATTERN)) {
		const alphaTarget = String(alphaMatch[1] || '').toLowerCase();
		if (alphaTarget === 'alpha') {
			nextState.textColor = applyAssAlphaToColor(nextState.textColor, alphaMatch[2]);
			nextState.outlineColor = applyAssAlphaToColor(nextState.outlineColor, alphaMatch[2]);
			nextState.shadowColor = applyAssAlphaToColor(nextState.shadowColor, alphaMatch[2]);
			nextState.secondaryColor = applyAssAlphaToColor(nextState.secondaryColor, alphaMatch[2]);
		} else if (alphaTarget === '2a') {
			nextState.secondaryColor = applyAssAlphaToColor(nextState.secondaryColor, alphaMatch[2]);
		} else if (alphaTarget === '3a') {
			nextState.outlineColor = applyAssAlphaToColor(nextState.outlineColor, alphaMatch[2]);
		} else if (alphaTarget === '4a') {
			nextState.shadowColor = applyAssAlphaToColor(nextState.shadowColor, alphaMatch[2]);
		} else {
			nextState.textColor = applyAssAlphaToColor(nextState.textColor, alphaMatch[2]);
		}
	}
	return nextState;
};

const appendAssTextRun = (lineRuns, text, state, karaoke = null) => {
	if (!text) return false;
	let appended = false;
	const parts = String(text).split(ASS_LINE_BREAK_PATTERN);
	parts.forEach((part, index) => {
		if (index > 0) lineRuns.push([]);
		if (!part) return;
		if (lineRuns.length === 0) lineRuns.push([]);
		lineRuns[lineRuns.length - 1].push({
			text: part,
			style: getAssStyleObjectFromState(state),
			...(karaoke ? {karaoke} : {})
		});
		appended = true;
	});
	return appended;
};

const buildAssRunLines = (raw, playResY, sourceStyle, sourceStyles = null) => {
	const lineRuns = [[]];
	let cursor = 0;
	const baseState = buildAssStyleState(sourceStyle, playResY);
	const resolveStyleState = (styleName) => {
		if (!(sourceStyles instanceof Map)) return null;
		const style = getAssStyle(sourceStyles, styleName);
		return style ? buildAssStyleState(style, playResY) : null;
	};
	let state = {...baseState};
	let drawingMode = 0;
	let karaokeOffsetMs = 0;
	let pendingKaraoke = null;
	const appendVisibleText = (text) => {
		const appended = appendAssTextRun(lineRuns, text, state, pendingKaraoke);
		if (appended && pendingKaraoke) {
			karaokeOffsetMs += pendingKaraoke.durationMs;
			pendingKaraoke = null;
		}
	};
	const overridePattern = new RegExp(ASS_OVERRIDE_BLOCK_PATTERN.source, 'g');
	let match = overridePattern.exec(raw);
	while (match) {
		if (drawingMode <= 0) {
			appendVisibleText(raw.slice(cursor, match.index));
		}
		state = applyAssOverrideBlockToState(
			stripAssTransformBlocks(match[0]),
			state,
			playResY,
			baseState,
			resolveStyleState
		);
		drawingMode = getAssDrawingModeFromBlock(match[0], drawingMode);
		const karaoke = buildAssKaraokeFromBlock(match[0], state, karaokeOffsetMs);
		if (karaoke) pendingKaraoke = karaoke;
		cursor = match.index + match[0].length;
		match = overridePattern.exec(raw);
	}
	if (drawingMode <= 0) {
		appendVisibleText(raw.slice(cursor));
	}
	return lineRuns
		.map((line) => line.filter((run) => run.text))
		.filter((line) => line.length > 0);
};

export const parseSubtitleCueText = (
	value,
	playResX = DEFAULT_ASS_PLAY_RES_X,
	playResY = DEFAULT_ASS_PLAY_RES_Y,
	sourceStyle = null,
	sourceStyles = null
) => {
	const raw = String(value || '');
	let assAlignment = null;
	let absolutePosition = null;
	let origin = null;
	let move = null;
	let sourceFontSize = null;
	let wrapStyle = null;
	let fade = null;
	let complexFade = null;
	let clip = null;
	let hasAssOverrides = false;
	let drawingMode = 0;
	let cursor = 0;
	const textParts = [];
	const overridePattern = new RegExp(ASS_OVERRIDE_BLOCK_PATTERN.source, 'g');
	let overrideMatch = overridePattern.exec(raw);
	while (overrideMatch) {
		if (drawingMode <= 0) {
			textParts.push(raw.slice(cursor, overrideMatch.index));
		}
		const block = overrideMatch[0];
		hasAssOverrides = true;
		const blockAlignment = getAssAlignmentFromOverrideBlock(block);
		if (blockAlignment !== null) {
			assAlignment = blockAlignment;
		}
		const positionMatch = block.match(ASS_POSITION_PATTERN);
		if (positionMatch) {
			absolutePosition = buildAssAbsolutePosition(positionMatch, playResX, playResY);
		}
		const originMatch = block.match(ASS_ORIGIN_PATTERN);
		if (originMatch) {
			origin = buildAssOrigin(originMatch, playResX, playResY);
		}
		const moveMatch = block.match(ASS_MOVE_PATTERN);
		if (moveMatch) {
			move = buildAssMove(moveMatch, playResX, playResY);
			if (move && !absolutePosition) {
				absolutePosition = move.startPosition;
			}
		}
		const fontSizeMatch = block.match(ASS_FONT_SIZE_PATTERN);
		if (fontSizeMatch) {
			const baseFontSize = sourceFontSize?.size ?? normalizeAssNumber(sourceStyle?.fontSize);
			sourceFontSize = buildAssFontSizeOverride(fontSizeMatch[1], playResY, baseFontSize);
		}
		const wrapStyleMatch = block.match(ASS_WRAP_STYLE_PATTERN);
		if (wrapStyleMatch) {
			wrapStyle = normalizeAssWrapStyle(wrapStyleMatch[1]);
		}
		const fadeMatch = block.match(ASS_FADE_PATTERN);
		if (fadeMatch) {
			fade = buildAssFade(fadeMatch);
		}
		const complexFadeMatch = block.match(ASS_COMPLEX_FADE_PATTERN);
		if (complexFadeMatch) {
			complexFade = buildAssComplexFade(complexFadeMatch);
		}
		const clipFromBlock = buildAssClipFromBlock(block, playResX, playResY);
		if (clipFromBlock) {
			clip = clipFromBlock;
		}
		drawingMode = getAssDrawingModeFromBlock(block, drawingMode);
		if (drawingMode <= 0) {
			textParts.push(buildAssInlineFormattingReplacement(block));
		}
		cursor = overrideMatch.index + block.length;
		overrideMatch = overridePattern.exec(raw);
	}
	if (drawingMode <= 0) {
		textParts.push(raw.slice(cursor));
	}
	const text = textParts
		.join('')
		.replace(ASS_LINE_BREAK_PATTERN, '\n');
	let lineRuns = hasAssOverrides || sourceStyle
		? buildAssRunLines(raw, playResY, sourceStyle, sourceStyles)
		: [];
	const transforms = parseAssTransforms({
		raw,
		playResY,
		sourceStyle,
		sourceStyles,
		buildAssStyleState,
		getAssStyle,
		applyAssOverrideBlockToState,
		getAssStyleObjectFromState
	});
	const sourceStyleObject = sourceStyle ? getAssStyleObjectFromState(buildAssStyleState(sourceStyle, playResY)) : null;
	const drawing = buildAssDrawingFromRaw(raw, playResX, playResY, sourceStyle);
	const sharedOriginTransformStyle = origin && absolutePosition
		? getSharedAssRunTransformStyle(lineRuns)
		: null;
	if (sharedOriginTransformStyle) {
		lineRuns = stripAssRunTransformStyle(lineRuns);
	}
	const cueSourceStyle = {
		...(sourceStyleObject || {}),
		...(sharedOriginTransformStyle || {})
	};
	return {
		text,
		assPlacement: getPlacementFromAssAlignment(assAlignment),
		assAlignment: getHorizontalAlignFromAssAlignment(assAlignment),
		absolutePosition,
		hasAssOverrides,
		...(origin ? {origin} : {}),
		...(lineRuns.length > 0 ? {runLines: lineRuns} : {}),
		...(Object.keys(cueSourceStyle).length > 0 ? {sourceStyle: cueSourceStyle} : {}),
		...(fade ? {fade} : {}),
		...(complexFade ? {complexFade} : {}),
		...(clip ? {clip} : {}),
		...(drawing ? {drawing} : {}),
		...(transforms.length > 0 ? {transforms} : {}),
		...(move ? {move} : {}),
		...(wrapStyle !== null ? {wrapStyle} : {}),
		...(sourceFontSize ? {sourceFontSize} : {})
	};
};

const parseAssMetadata = (text) => {
	const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	let section = '';
	let playResX = null;
	let playResY = null;
	let layoutResX = null;
	let layoutResY = null;
	let scaledBorderAndShadow = true;
	let wrapStyle = null;
	let styleFormat = [];
	const styles = new Map();
	lines.forEach((line) => {
		const trimmed = line.trim();
		const sectionMatch = trimmed.match(/^\[([^\]]+)]$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim().toLowerCase();
			return;
		}
		if (section === ASS_SCRIPT_INFO_SECTION) {
			if (/^PlayResX\s*:/i.test(trimmed)) {
				playResX = Number(trimmed.replace(/^PlayResX\s*:/i, '').trim());
			}
			if (/^PlayResY\s*:/i.test(trimmed)) {
				playResY = Number(trimmed.replace(/^PlayResY\s*:/i, '').trim());
			}
			if (/^LayoutResX\s*:/i.test(trimmed)) {
				layoutResX = Number(trimmed.replace(/^LayoutResX\s*:/i, '').trim());
			}
			if (/^LayoutResY\s*:/i.test(trimmed)) {
				layoutResY = Number(trimmed.replace(/^LayoutResY\s*:/i, '').trim());
			}
			if (/^ScaledBorderAndShadow\s*:/i.test(trimmed)) {
				scaledBorderAndShadow = !/^no$/i.test(
					trimmed.replace(/^ScaledBorderAndShadow\s*:/i, '').trim()
				);
			}
			if (/^WrapStyle\s*:/i.test(trimmed)) {
				wrapStyle = normalizeAssWrapStyle(trimmed.replace(/^WrapStyle\s*:/i, '').trim());
			}
			return;
		}
		if (!ASS_STYLE_SECTION_NAMES.has(section)) return;
		if (/^Format:/i.test(trimmed)) {
			styleFormat = trimmed
				.replace(/^Format:/i, '')
				.split(',')
				.map((part) => part.trim().toLowerCase());
			return;
		}
		if (!/^Style:/i.test(trimmed) || styleFormat.length === 0) return;
		const values = trimmed
			.replace(/^Style:/i, '')
			.split(',')
			.map((part) => part.trim());
		const nameIndex = styleFormat.indexOf('name');
	const fontNameIndex = styleFormat.indexOf('fontname');
	const fontSizeIndex = styleFormat.indexOf('fontsize');
		if (nameIndex < 0) return;
		const styleName = values[nameIndex] || '';
		if (!styleName) return;
		const fontSize = normalizeAssNumber(values[fontSizeIndex]);
		const alignment = normalizeAssAlignmentNumber(values[styleFormat.indexOf('alignment')]);
		const marginL = normalizeAssMarginValue(values[styleFormat.indexOf('marginl')]);
		const marginR = normalizeAssMarginValue(values[styleFormat.indexOf('marginr')]);
		const marginV = normalizeAssMarginValue(values[styleFormat.indexOf('marginv')]);
		const outline = normalizeAssNumber(values[styleFormat.indexOf('outline')]);
		const shadow = normalizeAssNumber(values[styleFormat.indexOf('shadow')]);
		const borderStyle = normalizeAssNumber(values[styleFormat.indexOf('borderstyle')]);
		const scaleX = normalizeAssNumber(values[styleFormat.indexOf('scalex')]);
		const scaleY = normalizeAssNumber(values[styleFormat.indexOf('scaley')]);
		const spacing = normalizeAssNumber(values[styleFormat.indexOf('spacing')]);
		const angle = normalizeAssNumber(values[styleFormat.indexOf('angle')]);
		const style = {
			...(values[fontNameIndex] ? {fontName: values[fontNameIndex]} : {}),
			...(fontSize !== null && fontSize > 0 ? {fontSize} : {}),
			...(alignment !== null ? {alignment} : {}),
			...(marginL !== null ? {marginL} : {}),
			...(marginR !== null ? {marginR} : {}),
			...(marginV !== null ? {marginV} : {}),
			...(values[styleFormat.indexOf('primarycolour')] ? {
				primaryColor: normalizeAssColorHex(values[styleFormat.indexOf('primarycolour')])
			} : {}),
			...(values[styleFormat.indexOf('secondarycolour')] ? {
				secondaryColor: normalizeAssColorHex(values[styleFormat.indexOf('secondarycolour')])
			} : {}),
			...(values[styleFormat.indexOf('outlinecolour')] ? {
				outlineColor: normalizeAssColorHex(values[styleFormat.indexOf('outlinecolour')])
			} : {}),
			...(values[styleFormat.indexOf('backcolour')] ? {
				backColor: normalizeAssColorHex(values[styleFormat.indexOf('backcolour')])
			} : {}),
			...(normalizeAssBoolean(values[styleFormat.indexOf('bold')]) ? {bold: true} : {}),
			...(normalizeAssBoolean(values[styleFormat.indexOf('italic')]) ? {italic: true} : {}),
			...(normalizeAssBoolean(values[styleFormat.indexOf('underline')]) ? {underline: true} : {}),
			...(normalizeAssBoolean(values[styleFormat.indexOf('strikeout')]) ? {strikeOut: true} : {}),
			...(borderStyle !== null ? {borderStyle} : {}),
			...(outline !== null ? {outline} : {}),
			...(shadow !== null ? {shadow} : {}),
			...(scaleX !== null ? {scaleX} : {}),
			...(scaleY !== null ? {scaleY} : {}),
			...(spacing !== null ? {spacing} : {}),
			...(angle !== null ? {angle} : {})
		};
		if (Object.keys(style).length === 0) return;
		const normalizedStyleName = styleName.trim().toLowerCase();
		styles.set(normalizedStyleName, style);
		if (normalizedStyleName === 'default') {
			styles.set('', style);
		}
	});
	return {
		playResX: normalizeAssPlayResValue(playResX, DEFAULT_ASS_PLAY_RES_X),
		playResY: normalizeAssPlayResValue(playResY, DEFAULT_ASS_PLAY_RES_Y),
		layoutResX: normalizeAssNumber(layoutResX),
		layoutResY: normalizeAssNumber(layoutResY),
		scaledBorderAndShadow,
		wrapStyle,
		styles
	};
};

const parseAssTimestampToTicks = (value) => {
	const raw = String(value || '').trim();
	const assMatch = raw.match(ASS_TIME_PATTERN);
	if (!assMatch) return null;
	const [, hours, minutes, seconds, centiseconds] = assMatch;
	const totalSeconds =
		Number(hours) * 3600 +
		Number(minutes) * 60 +
		Number(seconds) +
		Number(centiseconds.padEnd(2, '0')) / 100;
	return Math.round(totalSeconds * JELLYFIN_TICKS_PER_SECOND);
};

export const parseAssDialogueEvents = (text, format) => {
	const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const {
		playResX,
		playResY,
		layoutResX,
		layoutResY,
		scaledBorderAndShadow,
		styles,
		wrapStyle
	} = parseAssMetadata(text);
	let eventFormat = [];
	const events = [];
	lines.forEach((line) => {
		const trimmed = line.trim();
		if (/^Format:/i.test(trimmed)) {
			eventFormat = trimmed
				.replace(/^Format:/i, '')
				.split(',')
				.map((part) => part.trim().toLowerCase());
			return;
		}
		if (!/^Dialogue:/i.test(trimmed)) return;
		const payload = trimmed.replace(/^Dialogue:/i, '');
		const expectedParts = eventFormat.length || 10;
		const parts = payload.split(',', expectedParts);
		if (parts.length < expectedParts) return;
		const textIndex = eventFormat.indexOf('text');
		const startIndex = eventFormat.indexOf('start');
		const endIndex = eventFormat.indexOf('end');
		const styleIndex = eventFormat.indexOf('style');
		const layerIndex = eventFormat.indexOf('layer');
		const marginLIndex = eventFormat.indexOf('marginl');
		const marginRIndex = eventFormat.indexOf('marginr');
		const marginVIndex = eventFormat.indexOf('marginv');
		if (startIndex < 0 || endIndex < 0 || textIndex < 0) return;
		const textParts = payload.split(',');
		const fixedParts = textParts.slice(0, textIndex);
		const subtitleText = textParts.slice(textIndex).join(',');
		const startTicks = parseAssTimestampToTicks(fixedParts[startIndex]);
		const endTicks = parseAssTimestampToTicks(fixedParts[endIndex]);
		if (!Number.isFinite(startTicks) || !Number.isFinite(endTicks) || endTicks < startTicks) return;
		const style = getAssStyle(styles, styleIndex >= 0 ? fixedParts[styleIndex] : '');
		const eventMarginL = normalizeAssMarginValue(fixedParts[marginLIndex]);
		const eventMarginR = normalizeAssMarginValue(fixedParts[marginRIndex]);
		const eventMarginV = normalizeAssMarginValue(fixedParts[marginVIndex]);
		events.push({
			StartPositionTicks: startTicks,
			EndPositionTicks: endTicks,
			Text: subtitleText,
			Format: format,
			PlayResX: playResX,
			PlayResY: playResY,
			LayoutResX: layoutResX,
			LayoutResY: layoutResY,
			ScaledBorderAndShadow: scaledBorderAndShadow,
			StyleFontSize: style?.fontSize,
			Alignment: style?.alignment,
			AssStyle: style,
			AssStyles: styles,
			AssMarginL: eventMarginL && eventMarginL > 0 ? eventMarginL : style?.marginL,
			AssMarginR: eventMarginR && eventMarginR > 0 ? eventMarginR : style?.marginR,
			AssMarginV: eventMarginV && eventMarginV > 0 ? eventMarginV : style?.marginV,
			WrapStyle: wrapStyle,
			Layer: layerIndex >= 0 ? fixedParts[layerIndex] : null,
			SourceOrder: events.length
		});
	});
	return events;
};

const getCueOpacityAtTicks = (event, currentTicks) => {
	const complexFade = event?.complexFade;
	if (complexFade) {
		const complexElapsedMs = ((currentTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
		const alphaToOpacity = (alpha) => Math.max(0, Math.min(1, 1 - (alpha / 255)));
		const interpolateAlpha = (fromAlpha, toAlpha, progress) => (
			fromAlpha + ((toAlpha - fromAlpha) * Math.max(0, Math.min(1, progress)))
		);
		if (complexElapsedMs <= complexFade.time1Ms) return alphaToOpacity(complexFade.alpha1);
		if (complexElapsedMs < complexFade.time2Ms) {
			const duration = Math.max(1, complexFade.time2Ms - complexFade.time1Ms);
			return alphaToOpacity(interpolateAlpha(
				complexFade.alpha1,
				complexFade.alpha2,
				(complexElapsedMs - complexFade.time1Ms) / duration
			));
		}
		if (complexElapsedMs <= complexFade.time3Ms) return alphaToOpacity(complexFade.alpha2);
		if (complexElapsedMs < complexFade.time4Ms) {
			const duration = Math.max(1, complexFade.time4Ms - complexFade.time3Ms);
			return alphaToOpacity(interpolateAlpha(
				complexFade.alpha2,
				complexFade.alpha3,
				(complexElapsedMs - complexFade.time3Ms) / duration
			));
		}
		return alphaToOpacity(complexFade.alpha3);
	}
	const fade = event?.fade;
	if (!fade) return null;
	const elapsedMs = ((currentTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
	const remainingMs = ((event.endTicks - currentTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
	let opacity = 1;
	if (fade.fadeInMs > 0 && elapsedMs < fade.fadeInMs) {
		opacity = Math.min(opacity, Math.max(0, elapsedMs / fade.fadeInMs));
	}
	if (fade.fadeOutMs > 0 && remainingMs < fade.fadeOutMs) {
		opacity = Math.min(opacity, Math.max(0, remainingMs / fade.fadeOutMs));
	}
	return Number.isFinite(opacity) ? opacity : null;
};

const getCueMovePositionAtTicks = (event, currentTicks) => {
	const move = event?.move;
	if (!move?.startPosition || !move?.endPosition) return null;
	const elapsedMs = ((currentTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
	const endMs = move.endMs ?? (((event.endTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000);
	if (elapsedMs <= move.startMs) return move.startPosition;
	if (elapsedMs >= endMs) return move.endPosition;
	const duration = Math.max(1, endMs - move.startMs);
	const progress = Math.max(0, Math.min(1, (elapsedMs - move.startMs) / duration));
	const interpolate = (fromValue, toValue) => fromValue + ((toValue - fromValue) * progress);
	return buildAssPositionFromCoordinates(
		interpolate(move.startPosition.x, move.endPosition.x),
		interpolate(move.startPosition.y, move.endPosition.y),
		move.startPosition.playResX,
		move.startPosition.playResY
	);
};

export const decorateActiveAssCue = (event, currentTicks) => {
	const opacity = getCueOpacityAtTicks(event, currentTicks);
	const activeSourceStyle = applyAssTransformsAtTicks(event, currentTicks, {getAssStyleObjectFromState});
	const activeAbsolutePosition = getCueMovePositionAtTicks(event, currentTicks);
	const karaokeRunLines = decorateAssKaraokeRuns(event, currentTicks);
	if (opacity === null && !activeSourceStyle && !activeAbsolutePosition && !karaokeRunLines) return event;
	return {
		...event,
		...(opacity !== null ? {opacity} : {}),
		...(activeSourceStyle ? {activeSourceStyle} : {}),
		...(activeAbsolutePosition ? {absolutePosition: activeAbsolutePosition} : {}),
		...(karaokeRunLines ? {runLines: karaokeRunLines} : {})
	};
};
