import {
	DEFAULT_ASS_PLAY_RES_X,
	DEFAULT_ASS_PLAY_RES_Y,
	normalizeAssPlayResValue
} from './subtitleRendererAssDimensions';

const normalizePositive = (value, fallback = 0) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

const ASS_CUE_SAFE_INLINE_RATIO = 0.02;
const ASS_CUE_SAFE_BLOCK_RATIO = 0.02;

export const getSubtitleVideoMetrics = ({videoElement = null, mediaSource = null} = {}) => {
	const videoStream = Array.isArray(mediaSource?.MediaStreams)
		? mediaSource.MediaStreams.find((stream) => stream?.Type === 'Video')
		: null;
	const viewportWidth = normalizePositive(
		videoElement?.clientWidth,
		typeof window !== 'undefined' ? window.innerWidth : 0
	);
	const viewportHeight = normalizePositive(
		videoElement?.clientHeight,
		typeof window !== 'undefined' ? window.innerHeight : 0
	);
	return {
		viewportWidth,
		viewportHeight,
		videoWidth: normalizePositive(
			videoElement?.videoWidth,
			normalizePositive(videoStream?.Width, normalizePositive(mediaSource?.Width, viewportWidth))
		),
		videoHeight: normalizePositive(
			videoElement?.videoHeight,
			normalizePositive(videoStream?.Height, normalizePositive(mediaSource?.Height, viewportHeight))
		)
	};
};

export const getSubtitleVideoStageGeometry = ({
	viewportWidth,
	viewportHeight,
	videoWidth,
	videoHeight
} = {}) => {
	const safeViewportWidth = normalizePositive(viewportWidth, 1920);
	const safeViewportHeight = normalizePositive(viewportHeight, 1080);
	const safeVideoWidth = normalizePositive(videoWidth, safeViewportWidth);
	const safeVideoHeight = normalizePositive(videoHeight, safeViewportHeight);
	const scale = Math.min(
		safeViewportWidth / safeVideoWidth,
		safeViewportHeight / safeVideoHeight
	);
	const width = safeVideoWidth * scale;
	const height = safeVideoHeight * scale;
	const left = (safeViewportWidth - width) / 2;
	const top = (safeViewportHeight - height) / 2;
	return {
		viewportWidth: safeViewportWidth,
		viewportHeight: safeViewportHeight,
		videoWidth: safeVideoWidth,
		videoHeight: safeVideoHeight,
		width,
		height,
		left,
		top,
		style: {
			left: `${((left / safeViewportWidth) * 100).toFixed(4)}%`,
			top: `${((top / safeViewportHeight) * 100).toFixed(4)}%`,
			width: `${((width / safeViewportWidth) * 100).toFixed(4)}%`,
			height: `${((height / safeViewportHeight) * 100).toFixed(4)}%`
		}
	};
};

const getCueScriptGeometry = (cue = {}) => cue.scriptGeometry || {};

export const getAssCoordinatePlane = (cue = {}, stageGeometry = {}) => {
	const scriptGeometry = getCueScriptGeometry(cue);
	const positionedGeometry = cue.absolutePosition || cue.clip || cue.sourceFontSize || cue.sourceMargins || cue.drawing || {};
	const playResX = normalizeAssPlayResValue(
		scriptGeometry.playResX ?? positionedGeometry.playResX,
		DEFAULT_ASS_PLAY_RES_X
	);
	const playResY = normalizeAssPlayResValue(
		scriptGeometry.playResY ?? positionedGeometry.playResY,
		DEFAULT_ASS_PLAY_RES_Y
	);
	const stageWidth = normalizePositive(stageGeometry.width, normalizePositive(stageGeometry.viewportWidth, 1920));
	const stageHeight = normalizePositive(stageGeometry.height, normalizePositive(stageGeometry.viewportHeight, 1080));
	const hasLayoutResolution = normalizePositive(scriptGeometry.layoutResX) > 0
		&& normalizePositive(scriptGeometry.layoutResY) > 0;
	const layoutResX = hasLayoutResolution
		? normalizePositive(scriptGeometry.layoutResX)
		: normalizePositive(stageGeometry.videoWidth, playResX);
	const layoutResY = hasLayoutResolution
		? normalizePositive(scriptGeometry.layoutResY)
		: normalizePositive(stageGeometry.videoHeight, playResY);
	const scaleX = stageWidth / playResX;
	const scaleY = stageHeight / playResY;
	const layoutScaleX = stageWidth / layoutResX;
	const layoutScaleY = stageHeight / layoutResY;
	return {
		width: playResX,
		height: playResY,
		playResX,
		playResY,
		layoutResX,
		layoutResY,
		stageWidth,
		stageHeight,
		renderedWidth: stageWidth,
		renderedHeight: stageHeight,
		offsetX: 0,
		offsetY: 0,
		scaleX,
		scaleY,
		layoutScaleX,
		layoutScaleY,
		pixelAspectScale: layoutScaleY > 0 ? layoutScaleX / layoutScaleY : 1,
		scaledBorderAndShadow: scriptGeometry.scaledBorderAndShadow !== false
	};
};

export const isSourceAuthoredAssCue = (cue = {}) => Boolean(
	cue.absolutePosition ||
	cue.move ||
	cue.origin ||
	cue.clip ||
	cue.drawing ||
	cue.sourceStyle?.transform ||
	cue.activeSourceStyle?.transform
);

const isAssPositionOutsidePlane = (position = {}) => {
	const xPercent = Number(position.xPercent);
	const yPercent = Number(position.yPercent);
	return (
		Number.isFinite(xPercent) && (xPercent < 0 || xPercent > 100)
	) || (
		Number.isFinite(yPercent) && (yPercent < 0 || yPercent > 100)
	);
};

export const getAssCueContainmentPolicy = (cue = {}) => {
	const sourceAuthored = isSourceAuthoredAssCue(cue);
	if (cue.clip) {
		return {contain: false, sourceAuthored, reason: 'authored-clip'};
	}
	if (cue.drawing) {
		return {contain: false, sourceAuthored, reason: 'authored-drawing'};
	}
	if (cue.move) {
		return {contain: false, sourceAuthored, reason: 'authored-motion'};
	}
	if (cue.origin) {
		return {contain: false, sourceAuthored, reason: 'authored-transform-origin'};
	}
	if (cue.sourceStyle?.transform || cue.activeSourceStyle?.transform) {
		return {contain: false, sourceAuthored, reason: 'authored-transform'};
	}
	if (cue.absolutePosition) {
		return {
			contain: false,
			sourceAuthored,
			reason: isAssPositionOutsidePlane(cue.absolutePosition)
				? 'authored-offscreen'
				: 'authored-position'
		};
	}
	return {
		contain: true,
		sourceAuthored,
		reason: 'managed-text-box'
	};
};

const normalizeRect = (rect = {}) => {
	const left = Number(rect.left);
	const top = Number(rect.top);
	const width = Number(rect.width);
	const height = Number(rect.height);
	if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
	return {
		left,
		top,
		width,
		height,
		right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
		bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height
	};
};

export const getAssCueContainment = ({
	cueRect,
	stageRect,
	preserveOverflow = false,
	sourceAuthored = false,
	safeInlineRatio = ASS_CUE_SAFE_INLINE_RATIO,
	safeBlockRatio = ASS_CUE_SAFE_BLOCK_RATIO
} = {}) => {
	const cueBounds = normalizeRect(cueRect);
	const stageBounds = normalizeRect(stageRect);
	if (!cueBounds || !stageBounds) {
		return {
			sourceAuthored: Boolean(sourceAuthored),
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			reason: 'unavailable'
		};
	}
	if (preserveOverflow) {
		return {
			sourceAuthored: Boolean(sourceAuthored),
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			reason: 'preserve-authored-overflow'
		};
	}

	const inlineInset = stageBounds.width * Math.max(0, Number(safeInlineRatio) || 0);
	const blockInset = stageBounds.height * Math.max(0, Number(safeBlockRatio) || 0);
	const availableBounds = {
		left: stageBounds.left + inlineInset,
		right: stageBounds.right - inlineInset,
		top: stageBounds.top + blockInset,
		bottom: stageBounds.bottom - blockInset
	};
	availableBounds.width = Math.max(1, availableBounds.right - availableBounds.left);
	availableBounds.height = Math.max(1, availableBounds.bottom - availableBounds.top);
	const scale = Math.min(
		1,
		availableBounds.width / cueBounds.width,
		availableBounds.height / cueBounds.height
	);
	const scaledWidth = cueBounds.width * scale;
	const scaledHeight = cueBounds.height * scale;
	const scaledLeft = cueBounds.left + ((cueBounds.width - scaledWidth) / 2);
	const scaledTop = cueBounds.top + ((cueBounds.height - scaledHeight) / 2);
	const scaledRight = scaledLeft + scaledWidth;
	const scaledBottom = scaledTop + scaledHeight;
	let offsetX = 0;
	let offsetY = 0;
	if (scaledLeft < availableBounds.left) {
		offsetX = availableBounds.left - scaledLeft;
	} else if (scaledRight > availableBounds.right) {
		offsetX = availableBounds.right - scaledRight;
	}
	if (scaledTop < availableBounds.top) {
		offsetY = availableBounds.top - scaledTop;
	} else if (scaledBottom > availableBounds.bottom) {
		offsetY = availableBounds.bottom - scaledBottom;
	}
	const shifted = Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01;
	return {
		sourceAuthored: Boolean(sourceAuthored),
		scale,
		offsetX,
		offsetY,
		availableBounds,
		reason: scale < 0.999 ? 'fit-and-contain' : (shifted ? 'contain' : 'within-bounds')
	};
};

export const getAssStageLengthPx = (value, axis, cue = {}, stageGeometry = {}) => {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return null;
	const plane = getAssCoordinatePlane(cue, stageGeometry);
	return numberValue * (axis === 'x' ? plane.scaleX : plane.scaleY);
};

export const getAssStagePercent = (value, axis, cue = {}, stageGeometry = {}) => {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return null;
	const plane = getAssCoordinatePlane(cue, stageGeometry);
	const isHorizontal = axis === 'x';
	const stageDimension = isHorizontal ? plane.stageWidth : plane.stageHeight;
	const offset = isHorizontal ? plane.offsetX : plane.offsetY;
	const scale = isHorizontal ? plane.scaleX : plane.scaleY;
	return stageDimension > 0 ? ((offset + (numberValue * scale)) / stageDimension) * 100 : null;
};
