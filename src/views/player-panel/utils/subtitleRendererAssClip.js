import {buildAssDrawingPathFromText} from './subtitleRendererAssDrawing';

const ASS_CLIP_RECT_PATTERN = /\\(i?clip)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i;
const ASS_CLIP_ANY_PATTERN = /\\(i?clip)\s*\(([^)]*)\)/i;
const ASS_VECTOR_CLIP_SCALE_PATTERN = /^\s*(\d+)\s*,\s*(.+)$/;
const ASS_VECTOR_DRAWING_COMMAND_PATTERN = /(?:^|\s)[mnlbspc](?:\s|$)/i;
const DEFAULT_ASS_PLAY_RES_X = 384;
const DEFAULT_ASS_PLAY_RES_Y = 288;

const normalizePlayRes = (value, fallback) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

const buildAssVectorClipFromContent = (clipType, content) => {
	let mode = 1;
	let drawingText = String(content || '').trim();
	const scaleMatch = drawingText.match(ASS_VECTOR_CLIP_SCALE_PATTERN);
	if (scaleMatch && ASS_VECTOR_DRAWING_COMMAND_PATTERN.test(scaleMatch[2])) {
		mode = Math.max(1, Number(scaleMatch[1]) || 1);
		drawingText = scaleMatch[2].trim();
	}
	if (!ASS_VECTOR_DRAWING_COMMAND_PATTERN.test(drawingText)) return null;
	const drawingPath = buildAssDrawingPathFromText(drawingText.replace(/,/g, ' '), mode);
	if (!drawingPath) return null;
	return {
		type: 'drawing',
		mode,
		pathData: drawingPath.pathData,
		bounds: drawingPath.bounds,
		inverted: String(clipType || '').toLowerCase() === 'iclip'
	};
};

export const buildAssClipFromBlock = (block, playResX, playResY) => {
	const match = String(block || '').match(ASS_CLIP_RECT_PATTERN);
	if (!match) {
		const vectorMatch = String(block || '').match(ASS_CLIP_ANY_PATTERN);
		return vectorMatch ? buildAssVectorClipFromContent(vectorMatch[1], vectorMatch[2]) : null;
	}
	const values = match.slice(2).map((value) => Number(value));
	if (!values.every(Number.isFinite)) return null;
	const [rawX1, rawY1, rawX2, rawY2] = values;
	const x1 = Math.min(rawX1, rawX2);
	const y1 = Math.min(rawY1, rawY2);
	const x2 = Math.max(rawX1, rawX2);
	const y2 = Math.max(rawY1, rawY2);
	if (x1 === x2 || y1 === y2) return null;
	const resolvedPlayResX = normalizePlayRes(playResX, DEFAULT_ASS_PLAY_RES_X);
	const resolvedPlayResY = normalizePlayRes(playResY, DEFAULT_ASS_PLAY_RES_Y);
	return {
		type: 'rect',
		x1,
		y1,
		x2,
		y2,
		playResX: resolvedPlayResX,
		playResY: resolvedPlayResY,
		leftPercent: (x1 / resolvedPlayResX) * 100,
		topPercent: (y1 / resolvedPlayResY) * 100,
		rightPercent: (x2 / resolvedPlayResX) * 100,
		bottomPercent: (y2 / resolvedPlayResY) * 100,
		inverted: String(match[1] || '').toLowerCase() === 'iclip'
	};
};
