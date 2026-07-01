import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	DEFAULT_ASS_PLAY_RES_Y,
	buildAssScaledValue
} from './subtitleRendererAssDimensions';
import {buildAssSourceFontSize} from './subtitleRendererAssFontSize';

export const ASS_TRANSFORM_PATTERN = /\\t\s*\(([^}]*)\)/ig;

const ASS_OVERRIDE_BLOCK_PATTERN = /\{\\[^}]*\}/g;
const SUPPORTED_ASS_TRANSFORM_TAGS = new Set([
	'1a',
	'1c',
	'2a',
	'2c',
	'3a',
	'3c',
	'4a',
	'4c',
	'a',
	'alpha',
	'be',
	'blur',
	'bord',
	'c',
	'fax',
	'fay',
	'fr',
	'frx',
	'fry',
	'frz',
	'fs',
	'fscx',
	'fscy',
	'fsp',
	'shad',
	'xbord',
	'xshad',
	'ybord',
	'yshad'
]);
const ASS_TRANSFORM_SCALAR_DEFAULTS = {
	scaleX: 100,
	scaleY: 100,
	rotationX: 0,
	rotationY: 0,
	rotationZ: 0,
	skewX: 0,
	skewY: 0
};
const ASS_TRANSFORM_SCALED_KEYS = [
	'outline',
	'shadow',
	'shadowX',
	'shadowY',
	'blur',
	'letterSpacing'
];
const ASS_TRANSFORM_COLOR_KEYS = [
	'textColor',
	'secondaryColor',
	'outlineColor',
	'shadowColor'
];
const ASS_TRANSFORM_STEP_KEYS = [
	'fontFamily',
	'bold',
	'italic',
	'underline',
	'strikeOut',
	'borderStyle'
];

export const stripAssTransformBlocks = (value) => String(value || '')
	.replace(new RegExp(ASS_TRANSFORM_PATTERN.source, 'ig'), '');

const normalizeAssNumber = (value) => {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const numberValue = Number(raw);
	return Number.isFinite(numberValue) ? numberValue : null;
};

const parseAssTransformPayload = (payload) => {
	const raw = String(payload || '');
	const parts = raw.split(',');
	const numbers = parts.map((part) => normalizeAssNumber(part));
	let tagSource = raw;
	let startMs = 0;
	let endMs = null;
	let accel = 1;
	if (numbers.length >= 4 && numbers.slice(0, 3).every((value) => value !== null)) {
		startMs = Math.max(0, numbers[0]);
		endMs = Math.max(0, numbers[1]);
		accel = Math.max(0.01, numbers[2]);
		tagSource = parts.slice(3).join(',');
	} else if (numbers.length >= 3 && numbers.slice(0, 2).every((value) => value !== null)) {
		startMs = Math.max(0, numbers[0]);
		endMs = Math.max(0, numbers[1]);
		tagSource = parts.slice(2).join(',');
	} else if (numbers.length >= 2 && numbers[0] !== null) {
		accel = Math.max(0.01, numbers[0]);
		tagSource = parts.slice(1).join(',');
	}
	return {
		startMs,
		endMs,
		accel,
		tagSource
	};
};

export const parseAssTransforms = ({
	raw,
	playResY,
	sourceStyle,
	sourceStyles,
	buildAssStyleState,
	getAssStyle,
	applyAssOverrideBlockToState,
	getAssStyleObjectFromState
} = {}) => {
	const transforms = [];
	const baseState = buildAssStyleState(sourceStyle, playResY);
	const resolveStyleState = (styleName) => {
		if (!(sourceStyles instanceof Map)) return null;
		const style = getAssStyle(sourceStyles, styleName);
		return style ? buildAssStyleState(style, playResY) : null;
	};
	let state = {...baseState};
	const overridePattern = new RegExp(ASS_OVERRIDE_BLOCK_PATTERN.source, 'g');
	for (const blockMatch of String(raw || '').matchAll(overridePattern)) {
		const block = blockMatch[0];
		const stateBeforeTransform = applyAssOverrideBlockToState(
			stripAssTransformBlocks(block),
			state,
			playResY,
			baseState,
			resolveStyleState
		);
		for (const transformMatch of block.matchAll(ASS_TRANSFORM_PATTERN)) {
			const {
				startMs,
				endMs,
				accel,
				tagSource
			} = parseAssTransformPayload(transformMatch[1]);
			const fromState = {...stateBeforeTransform};
			const targetState = applyAssOverrideBlockToState(
				`{${tagSource}}`,
				{...stateBeforeTransform},
				playResY,
				baseState,
				resolveStyleState
			);
			const targetStyle = getAssStyleObjectFromState(targetState);
			const unsupportedTags = [...tagSource.matchAll(/\\([a-z0-9]+)/ig)]
				.map((tagMatch) => tagMatch[1].toLowerCase())
				.filter((tag) => !SUPPORTED_ASS_TRANSFORM_TAGS.has(tag));
			if (Object.keys(targetStyle).length > 0 || unsupportedTags.length > 0) {
				transforms.push({
					startMs,
					endMs,
					accel,
					playResY,
					fromState,
					targetState,
					targetStyle,
					unsupportedTags
				});
			}
		}
		state = stateBeforeTransform;
	}
	return transforms;
};

const parseCssVhNumber = (value) => {
	const match = String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)vh$/);
	return match ? Number(match[1]) : null;
};

const parseCssColor = (value) => {
	const match = String(value || '').trim().match(/^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
	if (!match) return null;
	const red = Number(match[1]);
	const green = Number(match[2]);
	const blue = Number(match[3]);
	const alpha = match[4] !== undefined ? Number(match[4]) : 1;
	if (![red, green, blue, alpha].every(Number.isFinite)) return null;
	return {
		red: Math.max(0, Math.min(255, red)),
		green: Math.max(0, Math.min(255, green)),
		blue: Math.max(0, Math.min(255, blue)),
		alpha: Math.max(0, Math.min(1, alpha))
	};
};

const formatCssColor = ({red, green, blue, alpha}) => {
	const roundedRed = Math.round(red);
	const roundedGreen = Math.round(green);
	const roundedBlue = Math.round(blue);
	if (alpha < 1) {
		return `rgba(${roundedRed}, ${roundedGreen}, ${roundedBlue}, ${alpha.toFixed(3)})`;
	}
	return `rgb(${roundedRed}, ${roundedGreen}, ${roundedBlue})`;
};

const interpolateNumber = (fromValue, toValue, progress) => {
	const fromNumber = Number(fromValue);
	const toNumber = Number(toValue);
	if (!Number.isFinite(toNumber)) return Number.isFinite(fromNumber) ? fromNumber : null;
	const safeFrom = Number.isFinite(fromNumber) ? fromNumber : 0;
	return safeFrom + ((toNumber - safeFrom) * progress);
};

const interpolateCssValue = (fromValue, toValue, progress) => {
	const fromVh = parseCssVhNumber(fromValue);
	const toVh = parseCssVhNumber(toValue);
	if (fromVh !== null && toVh !== null) {
		return `${(fromVh + ((toVh - fromVh) * progress)).toFixed(3)}vh`;
	}
	return progress >= 1 ? toValue : fromValue;
};

const interpolateCssColorValue = (fromValue, toValue, progress) => {
	const fromColor = parseCssColor(fromValue);
	const toColor = parseCssColor(toValue);
	if (!toColor) return progress >= 1 ? toValue : fromValue;
	const safeFrom = fromColor || toColor;
	return formatCssColor({
		red: interpolateNumber(safeFrom.red, toColor.red, progress),
		green: interpolateNumber(safeFrom.green, toColor.green, progress),
		blue: interpolateNumber(safeFrom.blue, toColor.blue, progress),
		alpha: interpolateNumber(safeFrom.alpha, toColor.alpha, progress)
	});
};

const interpolateScaledStateValue = (fromValue, toValue, progress, playResY) => {
	const toSize = Number(toValue?.size);
	if (!Number.isFinite(toSize)) return fromValue || null;
	const fromSize = Number.isFinite(Number(fromValue?.size)) ? Number(fromValue.size) : 0;
	return buildAssScaledValue(interpolateNumber(fromSize, toSize, progress), playResY);
};

const interpolateAssStyleState = (fromState = {}, targetState = {}, progress = 0, playResY = DEFAULT_ASS_PLAY_RES_Y) => {
	const nextState = {...fromState};
	if (Number.isFinite(Number(targetState.fontSizeValue))) {
		const fromFontSize = Number.isFinite(Number(fromState.fontSizeValue))
			? Number(fromState.fontSizeValue)
			: Number(targetState.fontSizeValue);
		const fontSize = buildAssSourceFontSize(
			interpolateNumber(fromFontSize, targetState.fontSizeValue, progress),
			playResY
		);
		if (fontSize) {
			nextState.fontSize = `${fontSize.fontSizeVh.toFixed(3)}vh`;
			nextState.fontSizeValue = fontSize.size;
		}
	}
	Object.entries(ASS_TRANSFORM_SCALAR_DEFAULTS).forEach(([key, fallback]) => {
		if (Number.isFinite(Number(targetState[key]))) {
			nextState[key] = interpolateNumber(fromState[key] ?? fallback, targetState[key], progress);
		}
	});
	ASS_TRANSFORM_SCALED_KEYS.forEach((key) => {
		if (targetState[key]) {
			nextState[key] = interpolateScaledStateValue(fromState[key], targetState[key], progress, playResY);
		}
	});
	ASS_TRANSFORM_COLOR_KEYS.forEach((key) => {
		if (targetState[key]) {
			nextState[key] = interpolateCssColorValue(fromState[key], targetState[key], progress);
		}
	});
	if (progress >= 1) {
		ASS_TRANSFORM_STEP_KEYS.forEach((key) => {
			if (targetState[key] !== undefined) nextState[key] = targetState[key];
		});
	}
	return nextState;
};

export const applyAssTransformsAtTicks = (event, currentTicks, {getAssStyleObjectFromState} = {}) => {
	const transforms = Array.isArray(event?.transforms) ? event.transforms : [];
	if (transforms.length === 0) return null;
	const elapsedMs = ((currentTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
	return transforms.reduce((style, transform) => {
		const endMs = transform.endMs ?? (((event.endTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000);
		if (elapsedMs < transform.startMs) return style;
		const duration = Math.max(1, endMs - transform.startMs);
		const linearProgress = Math.max(0, Math.min(1, (elapsedMs - transform.startMs) / duration));
		const progress = Math.pow(linearProgress, transform.accel || 1);
		const interpolatedStyle = transform.fromState && transform.targetState && typeof getAssStyleObjectFromState === 'function'
			? getAssStyleObjectFromState(interpolateAssStyleState(
				transform.fromState,
				transform.targetState,
				progress,
				transform.playResY || event?.sourceFontSize?.playResY || DEFAULT_ASS_PLAY_RES_Y
			))
			: Object.entries(transform.targetStyle || {}).reduce((nextStyle, [key, targetValue]) => ({
				...nextStyle,
				[key]: interpolateCssValue(nextStyle[key], targetValue, progress)
			}), style);
		return {
			...style,
			...interpolatedStyle
		};
	}, {...(event.sourceStyle || {})});
};
