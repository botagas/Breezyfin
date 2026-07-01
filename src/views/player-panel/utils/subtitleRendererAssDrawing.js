import {normalizeAssColorHex} from './subtitleRendererAssColors';

const ASS_OVERRIDE_BLOCK_PATTERN = /\{\\[^}]*\}/g;
const ASS_DRAWING_MODE_PATTERN = /\\p\s*(-?\d+)/i;
const ASS_DRAWING_TOKEN_PATTERN = /[mnlbspc]|-?\d+(?:\.\d+)?/ig;
const ASS_DRAWING_COLOR_TAG_PATTERN = /\\([134]?c)\s*(&H[0-9a-f]+&?)/ig;
const ASS_DRAWING_ALPHA_TAG_PATTERN = /\\([134]?a|alpha)\s*(&H[0-9a-f]+&?)/ig;
const ASS_DRAWING_BORDER_PATTERN = /\\bord\s*([0-9]+(?:\.\d+)?)/i;
const ASS_DRAWING_SHADOW_PATTERN = /\\shad\s*([0-9]+(?:\.\d+)?)/i;
const ASS_DRAWING_BASELINE_OFFSET_PATTERN = /\\pbo\s*(-?[0-9]+(?:\.\d+)?)/i;

const normalizeAssNumber = (value) => {
	const numberValue = Number(String(value ?? '').trim());
	return Number.isFinite(numberValue) ? numberValue : null;
};

const applyAlphaToColor = (color, alphaValue) => {
	const alphaMatch = String(alphaValue || '').trim().match(/^&H([0-9a-f]{1,2})&?$/i);
	if (!color || !alphaMatch) return color;
	const alpha = parseInt(alphaMatch[1], 16);
	if (!Number.isFinite(alpha)) return color;
	const opacity = Math.max(0, Math.min(1, 1 - (alpha / 255)));
	const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
	return match ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity.toFixed(3)})` : color;
};

export const getAssDrawingModeFromBlock = (block, currentMode = 0) => {
	const match = String(block || '').match(ASS_DRAWING_MODE_PATTERN);
	if (!match) return currentMode;
	const mode = normalizeAssNumber(match[1]);
	return mode !== null && mode > 0 ? mode : 0;
};

const buildInitialDrawingState = (sourceStyle = {}) => {
	const style = sourceStyle || {};
	return {
		fillColor: style.primaryColor || 'currentColor',
		strokeColor: style.outlineColor || '',
		shadowColor: style.backColor || '',
		strokeWidth: Number(style.outline) || 0,
		shadowWidth: Number(style.shadow) || 0,
		baselineOffset: 0
	};
};

const updateDrawingStateFromBlock = (block, state = {}) => {
	const nextState = {...state};
	for (const colorMatch of String(block || '').matchAll(ASS_DRAWING_COLOR_TAG_PATTERN)) {
		const color = normalizeAssColorHex(colorMatch[2]);
		if (!color) continue;
		const target = String(colorMatch[1] || '').toLowerCase();
		if (target === '3c') nextState.strokeColor = color;
		else if (target === '4c') nextState.shadowColor = color;
		else nextState.fillColor = color;
	}
	for (const alphaMatch of String(block || '').matchAll(ASS_DRAWING_ALPHA_TAG_PATTERN)) {
		const target = String(alphaMatch[1] || '').toLowerCase();
		if (target === 'alpha') {
			nextState.fillColor = applyAlphaToColor(nextState.fillColor, alphaMatch[2]);
			nextState.strokeColor = applyAlphaToColor(nextState.strokeColor, alphaMatch[2]);
			nextState.shadowColor = applyAlphaToColor(nextState.shadowColor, alphaMatch[2]);
		} else if (target === '3a') {
			nextState.strokeColor = applyAlphaToColor(nextState.strokeColor, alphaMatch[2]);
		} else if (target === '4a') {
			nextState.shadowColor = applyAlphaToColor(nextState.shadowColor, alphaMatch[2]);
		} else {
			nextState.fillColor = applyAlphaToColor(nextState.fillColor, alphaMatch[2]);
		}
	}
	const borderMatch = String(block || '').match(ASS_DRAWING_BORDER_PATTERN);
	if (borderMatch) nextState.strokeWidth = Math.max(0, Number(borderMatch[1]) || 0);
	const shadowMatch = String(block || '').match(ASS_DRAWING_SHADOW_PATTERN);
	if (shadowMatch) nextState.shadowWidth = Math.max(0, Number(shadowMatch[1]) || 0);
	const baselineOffsetMatch = String(block || '').match(ASS_DRAWING_BASELINE_OFFSET_PATTERN);
	if (baselineOffsetMatch) {
		const baselineOffset = normalizeAssNumber(baselineOffsetMatch[1]);
		if (baselineOffset !== null) nextState.baselineOffset = baselineOffset;
	}
	return nextState;
};

const parseDrawingTokens = (value) => String(value || '')
	.match(ASS_DRAWING_TOKEN_PATTERN)
	?.map((token) => token.toLowerCase()) || [];

const takePoint = (tokens, index, scale) => {
	const x = Number(tokens[index]);
	const y = Number(tokens[index + 1]);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return {
		point: {
			x: x / scale,
			y: y / scale
		},
		nextIndex: index + 2
	};
};

const addBoundsPoint = (bounds, point) => {
	if (!point) return bounds;
	return {
		minX: Math.min(bounds.minX, point.x),
		minY: Math.min(bounds.minY, point.y),
		maxX: Math.max(bounds.maxX, point.x),
		maxY: Math.max(bounds.maxY, point.y)
	};
};

const formatPoint = (point) => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;

const isDrawingCommandToken = (token) => /^[a-z]$/u.test(token);

const getBsplinePoint = (left, centerLeft, centerRight, right) => ({
	x: ((left.x) + (4 * centerLeft.x) + (centerRight.x)) / 6,
	y: ((left.y) + (4 * centerLeft.y) + (centerRight.y)) / 6,
	control1: {
		x: ((4 * centerLeft.x) + (2 * centerRight.x)) / 6,
		y: ((4 * centerLeft.y) + (2 * centerRight.y)) / 6
	},
	control2: {
		x: ((2 * centerLeft.x) + (4 * centerRight.x)) / 6,
		y: ((2 * centerLeft.y) + (4 * centerRight.y)) / 6
	},
	end: {
		x: ((centerLeft.x) + (4 * centerRight.x) + (right.x)) / 6,
		y: ((centerLeft.y) + (4 * centerRight.y) + (right.y)) / 6
	}
});

const collectPointsUntilCommand = (tokens, index, scale) => {
	const points = [];
	let nextIndex = index;
	while (nextIndex < tokens.length && !isDrawingCommandToken(tokens[nextIndex])) {
		const pointResult = takePoint(tokens, nextIndex, scale);
		if (!pointResult) break;
		points.push(pointResult.point);
		nextIndex = pointResult.nextIndex;
	}
	return {points, nextIndex};
};

export const buildAssDrawingPathFromText = (text, mode = 1) => {
	const scale = Math.pow(2, Math.max(0, mode - 1));
	const tokens = parseDrawingTokens(text);
	const path = [];
	let bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
	let index = 0;
	let command = '';
	let currentPoint = null;
	let pendingSplinePoints = [];
	const flushSpline = (close = false) => {
		if (pendingSplinePoints.length === 0) return;
		const splinePoints = close && pendingSplinePoints.length >= 3
			? [...pendingSplinePoints, pendingSplinePoints[0], pendingSplinePoints[1], pendingSplinePoints[2]]
			: pendingSplinePoints;
		if (splinePoints.length < 4) {
			splinePoints.slice(1).forEach((point) => {
				path.push(`L ${formatPoint(point)}`);
				bounds = addBoundsPoint(bounds, point);
				currentPoint = point;
			});
			if (close) path.push('Z');
			pendingSplinePoints = [];
			return;
		}
		for (let splineIndex = 0; splineIndex <= splinePoints.length - 4; splineIndex += 1) {
			const segment = getBsplinePoint(
				splinePoints[splineIndex],
				splinePoints[splineIndex + 1],
				splinePoints[splineIndex + 2],
				splinePoints[splineIndex + 3]
			);
			if (splineIndex === 0) {
				path.push(`${path.length === 0 ? 'M' : 'L'} ${formatPoint(segment)}`);
			}
			path.push(`C ${formatPoint(segment.control1)} ${formatPoint(segment.control2)} ${formatPoint(segment.end)}`);
			bounds = [
				segment,
				segment.control1,
				segment.control2,
				segment.end
			].reduce(addBoundsPoint, bounds);
			currentPoint = segment.end;
		}
		if (close) path.push('Z');
		pendingSplinePoints = [];
	};
	while (index < tokens.length) {
		if (isDrawingCommandToken(tokens[index])) {
			if (pendingSplinePoints.length > 0 && tokens[index] !== 'p' && tokens[index] !== 'c') {
				flushSpline(false);
			}
			command = tokens[index];
			index += 1;
		}
		if (command === 'm' || command === 'n') {
			const pointResult = takePoint(tokens, index, scale);
			if (!pointResult) break;
			path.push(`M ${formatPoint(pointResult.point)}`);
			bounds = addBoundsPoint(bounds, pointResult.point);
			currentPoint = pointResult.point;
			index = pointResult.nextIndex;
			command = 'l';
		} else if (command === 'l') {
			const pointResult = takePoint(tokens, index, scale);
			if (!pointResult) break;
			path.push(`L ${formatPoint(pointResult.point)}`);
			bounds = addBoundsPoint(bounds, pointResult.point);
			currentPoint = pointResult.point;
			index = pointResult.nextIndex;
		} else if (command === 'b') {
			const first = takePoint(tokens, index, scale);
			const second = first ? takePoint(tokens, first.nextIndex, scale) : null;
			const third = second ? takePoint(tokens, second.nextIndex, scale) : null;
			if (!first || !second || !third) break;
			path.push(`C ${formatPoint(first.point)} ${formatPoint(second.point)} ${formatPoint(third.point)}`);
			bounds = [first.point, second.point, third.point].reduce(addBoundsPoint, bounds);
			currentPoint = third.point;
			index = third.nextIndex;
		} else if (command === 's' || command === 'p') {
			const {points, nextIndex} = collectPointsUntilCommand(tokens, index, scale);
			if (points.length === 0) break;
			if (command === 's') {
				pendingSplinePoints = currentPoint ? [currentPoint, ...points] : [...points];
			} else {
				pendingSplinePoints = [...pendingSplinePoints, ...points];
			}
			index = nextIndex;
		} else if (command === 'c') {
			if (pendingSplinePoints.length > 0) {
				flushSpline(true);
			} else {
				path.push('Z');
			}
			command = '';
		} else {
			index += 1;
		}
	}
	flushSpline(false);
	if (path.length === 0 || !Number.isFinite(bounds.minX)) return null;
	return {
		pathData: path.join(' '),
		bounds
	};
};

const toViewBox = ({minX, minY, maxX, maxY}, padding = 0) => {
	const left = minX - padding;
	const top = minY - padding;
	const width = Math.max(1, (maxX - minX) + (padding * 2));
	const height = Math.max(1, (maxY - minY) + (padding * 2));
	return {
		x: left,
		y: top,
		width,
		height,
		value: `${left.toFixed(3)} ${top.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}`
	};
};

const getDrawingBaselineOffset = (state = {}) => {
	const baselineOffset = Number(state.baselineOffset);
	return Number.isFinite(baselineOffset) ? baselineOffset : 0;
};

const offsetDrawingBounds = (bounds, baselineOffset = 0) => ({
	minX: bounds.minX,
	minY: bounds.minY + baselineOffset,
	maxX: bounds.maxX,
	maxY: bounds.maxY + baselineOffset
});

export const buildAssDrawingFromRaw = (raw, playResX, playResY, sourceStyle = {}) => {
	if (!/\\p\s*-?\d+/i.test(String(raw || ''))) return null;
	const overridePattern = new RegExp(ASS_OVERRIDE_BLOCK_PATTERN.source, 'g');
	let mode = 0;
	let cursor = 0;
	let state = buildInitialDrawingState(sourceStyle);
	const drawings = [];
	let match = overridePattern.exec(String(raw || ''));
	while (match) {
		if (mode > 0) {
			const segment = String(raw || '').slice(cursor, match.index);
			const drawingPath = buildAssDrawingPathFromText(segment, mode);
			if (drawingPath) drawings.push({drawingPath, state: {...state}});
		}
		state = updateDrawingStateFromBlock(match[0], state);
		mode = getAssDrawingModeFromBlock(match[0], mode);
		cursor = match.index + match[0].length;
		match = overridePattern.exec(String(raw || ''));
	}
	if (mode > 0) {
		const drawingPath = buildAssDrawingPathFromText(String(raw || '').slice(cursor), mode);
		if (drawingPath) drawings.push({drawingPath, state: {...state}});
	}
	if (drawings.length === 0) return null;
	const bounds = drawings.reduce((nextBounds, drawing) => {
		const shiftedBounds = offsetDrawingBounds(
			drawing.drawingPath.bounds,
			getDrawingBaselineOffset(drawing.state)
		);
		return {
			minX: Math.min(nextBounds.minX, shiftedBounds.minX),
			minY: Math.min(nextBounds.minY, shiftedBounds.minY),
			maxX: Math.max(nextBounds.maxX, shiftedBounds.maxX),
			maxY: Math.max(nextBounds.maxY, shiftedBounds.maxY)
		};
	}, {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity});
	const maxStrokeWidth = drawings.reduce((maxValue, drawing) => (
		Math.max(maxValue, Number(drawing.state.strokeWidth) || 0, Number(drawing.state.shadowWidth) || 0)
	), 0);
	return {
		playResX,
		playResY,
		viewBox: toViewBox(bounds, maxStrokeWidth),
		paths: drawings.map(({drawingPath, state: drawingState}) => ({
			d: drawingPath.pathData,
			fill: drawingState.fillColor || 'currentColor',
			stroke: drawingState.strokeColor || 'none',
			strokeWidth: Number(drawingState.strokeWidth) || 0,
			shadowColor: drawingState.shadowColor || '',
			shadowWidth: Number(drawingState.shadowWidth) || 0,
			baselineOffset: getDrawingBaselineOffset(drawingState)
		}))
	};
};
