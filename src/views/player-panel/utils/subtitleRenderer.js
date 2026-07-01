import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	SUBTITLE_ALIGN_CENTER,
	SUBTITLE_PLACEMENT_BOTTOM,
	buildAssSourceFontSize,
	buildAssSourceMargins,
	decorateActiveAssCue,
	getHorizontalAlignFromAlignment,
	getHorizontalAlignFromAssAlignment,
	getPlacementFromAlignment,
	getPlacementFromAssAlignment,
	getPlacementFromPosition,
	normalizeAssNumber,
	normalizeAssWrapStyle,
	parseAssDialogueEvents,
	parseSubtitleCueText
} from './subtitleRendererAss';

export {parseSubtitleCueText} from './subtitleRendererAss';

const ALLOWED_SUBTITLE_TAGS = new Set(['BR', 'B', 'STRONG', 'I', 'EM', 'U', 'FONT', 'SPAN']);
const BLOCKED_SUBTITLE_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);
const SAFE_SUBTITLE_COLOR_NAMES = new Set([
	'black',
	'blue',
	'cyan',
	'gray',
	'green',
	'grey',
	'magenta',
	'orange',
	'red',
	'white',
	'yellow'
]);
const SRT_TIME_PATTERN = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const VTT_TIME_PATTERN = /(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{1,3})/;

const escapeHtml = (value) => String(value || '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const decodeEscapedSubtitleFormattingTags = (value) => String(value || '')
	.replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, '<$1$2>')
	.replace(/&lt;br\s*\/?&gt;/gi, '<br>')
	.replace(/&lt;(font|span)\s+([^&]*)&gt;/gi, '<$1 $2>')
	.replace(/&lt;\/(font|span)&gt;/gi, '</$1>');

const unwrapNode = (node) => {
	const parent = node.parentNode;
	if (!parent) return;
	while (node.firstChild) {
		parent.insertBefore(node.firstChild, node);
	}
	parent.removeChild(node);
};

const normalizeSubtitleCssColor = (value) => {
	const color = String(value || '').trim();
	if (!color) return '';
	if (/^#[0-9a-f]{3}(?:[0-9a-f]{1})?$/i.test(color)) return color;
	if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)) return color;
	const rgbMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
	if (rgbMatch) {
		const [, red, green, blue, alpha] = rgbMatch;
		const parts = [red, green, blue].map((part) => Number(part));
		if (parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
			return alpha !== undefined
				? `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${Number(alpha)})`
				: `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
		}
	}
	const named = color.toLowerCase();
	return SAFE_SUBTITLE_COLOR_NAMES.has(named) ? named : '';
};

const getSafeSubtitleColorFromStyle = (value) => {
	const match = String(value || '').match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
	return normalizeSubtitleCssColor(match?.[1]);
};

const applySafeSubtitleAttributes = (node) => {
	let safeColor = '';
	if (node.tagName === 'FONT') {
		safeColor = normalizeSubtitleCssColor(node.getAttribute('color'));
	}
	if (node.tagName === 'SPAN') {
		safeColor = getSafeSubtitleColorFromStyle(node.getAttribute('style'));
	}
	Array.from(node.attributes || []).forEach((attribute) => {
		node.removeAttribute(attribute.name);
	});
	if (safeColor) {
		node.setAttribute('style', `color: ${safeColor}`);
	}
	return Boolean(safeColor);
};

const sanitizeNode = (node) => {
	const nodeTypes = window.Node;
	Array.from(node.childNodes || []).forEach((child) => {
		if (child.nodeType === nodeTypes.COMMENT_NODE) {
			child.remove();
			return;
		}
		if (child.nodeType !== nodeTypes.ELEMENT_NODE) return;
		if (BLOCKED_SUBTITLE_TAGS.has(child.tagName)) {
			child.remove();
			return;
		}
		if (!ALLOWED_SUBTITLE_TAGS.has(child.tagName)) {
			sanitizeNode(child);
			unwrapNode(child);
			return;
		}
		const hasSafeFormattingAttribute = applySafeSubtitleAttributes(child);
		sanitizeNode(child);
		if ((child.tagName === 'FONT' || child.tagName === 'SPAN') && !hasSafeFormattingAttribute) {
			unwrapNode(child);
		}
	});
};

export const sanitizeSubtitleHtml = (value) => {
	const raw = String(value || '');
	if (!raw) return '';
	if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.Node === 'undefined') {
		return escapeHtml(raw).replace(/\n/g, '<br />');
	}
	const template = document.createElement('template');
	template.innerHTML = decodeEscapedSubtitleFormattingTags(raw).replace(/\n/g, '<br />');
	sanitizeNode(template.content);
	return template.innerHTML;
};

const buildCueLines = (value, playResX, playResY) => {
	const parsed = parseSubtitleCueText(value, playResX, playResY);
	const html = sanitizeSubtitleHtml(parsed.text).trim();
	if (!html) return [];
	return html
		.split(/<br\s*\/?>/gi)
		.map((line) => line.trim())
		.filter(Boolean);
};

const normalizeCuePosition = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : null;
};

export const normalizeSubtitleEvents = (events = []) => {
	if (!Array.isArray(events)) return [];
	return events
		.map((event) => {
			const parsedText = parseSubtitleCueText(
				event?.Text,
				event?.PlayResX,
				event?.PlayResY,
				event?.AssStyle,
				event?.AssStyles
			);
			const lines = buildCueLines(event?.Text, event?.PlayResX, event?.PlayResY);
			const position = normalizeCuePosition(event?.Position);
			const alignment = event?.Alignment || null;
			const absolutePosition = parsedText.absolutePosition ? {absolutePosition: parsedText.absolutePosition} : {};
			const sourceFontSize = parsedText.sourceFontSize ||
				buildAssSourceFontSize(event?.StyleFontSize, event?.PlayResY);
			const sourceMargins = buildAssSourceMargins({
				marginL: event?.AssMarginL,
				marginR: event?.AssMarginR,
				marginV: event?.AssMarginV,
				playResX: event?.PlayResX,
				playResY: event?.PlayResY
			});
			const wrapStyle = parsedText.wrapStyle ?? normalizeAssWrapStyle(event?.WrapStyle);
			const layer = normalizeAssNumber(event?.Layer);
			const sourceOrder = normalizeAssNumber(event?.SourceOrder);
			return {
				startTicks: Number(event?.StartPositionTicks),
				endTicks: Number(event?.EndPositionTicks),
				lines,
				format: event?.Format || 'jellyfin-track-event',
				position,
				alignment,
				placement:
					parsedText.assPlacement ||
					getPlacementFromAssAlignment(alignment) ||
					getPlacementFromAlignment(alignment) ||
					getPlacementFromPosition(position) ||
					SUBTITLE_PLACEMENT_BOTTOM,
				horizontalAlign:
					parsedText.assAlignment ||
					getHorizontalAlignFromAssAlignment(alignment) ||
					getHorizontalAlignFromAlignment(alignment) ||
					SUBTITLE_ALIGN_CENTER,
				hasAssOverrides: parsedText.hasAssOverrides,
				...absolutePosition,
				...(parsedText.origin ? {origin: parsedText.origin} : {}),
				...(parsedText.runLines ? {runLines: parsedText.runLines} : {}),
				...(parsedText.sourceStyle ? {sourceStyle: parsedText.sourceStyle} : {}),
				...(parsedText.fade ? {fade: parsedText.fade} : {}),
				...(parsedText.complexFade ? {complexFade: parsedText.complexFade} : {}),
				...(parsedText.clip ? {clip: parsedText.clip} : {}),
				...(parsedText.drawing ? {drawing: parsedText.drawing} : {}),
				...(parsedText.transforms ? {transforms: parsedText.transforms} : {}),
				...(parsedText.move ? {move: parsedText.move} : {}),
				...(sourceMargins ? {sourceMargins} : {}),
				...(wrapStyle !== null ? {wrapStyle} : {}),
				...(layer !== null ? {layer} : {}),
				...(sourceOrder !== null ? {sourceOrder} : {}),
				...(sourceFontSize ? {sourceFontSize} : {})
			};
		})
		.filter((event) => (
			Number.isFinite(event.startTicks) &&
			Number.isFinite(event.endTicks) &&
			event.endTicks >= event.startTicks &&
			(event.lines.length > 0 || Boolean(event.drawing))
		))
		.sort((left, right) => (
			left.startTicks - right.startTicks ||
			(left.layer ?? 0) - (right.layer ?? 0) ||
			(left.sourceOrder ?? 0) - (right.sourceOrder ?? 0) ||
			left.endTicks - right.endTicks
		));
};

const parseTimestampToTicks = (value) => {
	const raw = String(value || '').trim();
	const srtMatch = raw.match(SRT_TIME_PATTERN);
	if (srtMatch) {
		const [, hours, minutes, seconds, milliseconds] = srtMatch;
		const totalSeconds =
			Number(hours) * 3600 +
			Number(minutes) * 60 +
			Number(seconds) +
			Number(milliseconds.padEnd(3, '0')) / 1000;
		return Math.round(totalSeconds * JELLYFIN_TICKS_PER_SECOND);
	}
	const vttMatch = raw.match(VTT_TIME_PATTERN);
	if (vttMatch) {
		const [, hours = '0', minutes, seconds, milliseconds] = vttMatch;
		const totalSeconds =
			Number(hours || 0) * 3600 +
			Number(minutes) * 60 +
			Number(seconds) +
			Number(milliseconds.padEnd(3, '0')) / 1000;
		return Math.round(totalSeconds * JELLYFIN_TICKS_PER_SECOND);
	}
	return null;
};

const stripVttCueSettings = (value) => String(value || '').trim().split(/\s+/)[0] || '';

const parseCueBlock = (block, format) => {
	const lines = String(block || '')
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim() !== '');
	if (lines.length === 0) return null;
	const timingIndex = lines.findIndex((line) => line.includes('-->'));
	if (timingIndex < 0) return null;
	const [startRaw, endRaw] = lines[timingIndex].split('-->');
	const startTicks = parseTimestampToTicks(stripVttCueSettings(startRaw));
	const endTicks = parseTimestampToTicks(stripVttCueSettings(endRaw));
	if (!Number.isFinite(startTicks) || !Number.isFinite(endTicks) || endTicks < startTicks) return null;
	const textLines = lines.slice(timingIndex + 1);
	if (textLines.length === 0) return null;
	return {
		StartPositionTicks: startTicks,
		EndPositionTicks: endTicks,
		Text: textLines.join('\n'),
		Format: format
	};
};

export const normalizeSubtitleText = (text, format = 'vtt') => {
	const normalizedFormat = String(format || '').trim().toLowerCase() || 'vtt';
	const raw = String(text || '')
		.replace(/^\uFEFF/, '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
	if (!raw.trim()) return [];
	if (normalizedFormat === 'ass' || normalizedFormat === 'ssa') {
		return normalizeSubtitleEvents(parseAssDialogueEvents(raw, normalizedFormat));
	}
	const withoutHeader = raw
		.split('\n')
		.filter((line, index) => {
			const trimmed = line.trim();
			if (index === 0 && /^WEBVTT/i.test(trimmed)) return false;
			if (/^(NOTE|STYLE|REGION)(\s|$)/i.test(trimmed)) return false;
			return true;
		})
		.join('\n');
	const cueEvents = withoutHeader
		.split(/\n{2,}/)
		.map((block) => parseCueBlock(block, normalizedFormat))
		.filter(Boolean);
	return normalizeSubtitleEvents(cueEvents);
};

const findLastStartedCueIndex = (events, currentTicks) => {
	let low = 0;
	let high = events.length - 1;
	let result = -1;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (events[middle].startTicks <= currentTicks) {
			result = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	return result;
};

const getSubtitleSortNumber = (value, fallback = 0) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : fallback;
};

const compareActiveSubtitleRenderOrder = (left, right) => (
	getSubtitleSortNumber(left.layer) - getSubtitleSortNumber(right.layer) ||
	getSubtitleSortNumber(left.sourceOrder) - getSubtitleSortNumber(right.sourceOrder) ||
	left.startTicks - right.startTicks ||
	left.endTicks - right.endTicks
);

export const findActiveSubtitleCues = (events = [], currentTimeSeconds = 0) => {
	if (!Array.isArray(events) || events.length === 0) {
		return {
			cues: [],
			activeCount: 0
		};
	}
	const currentTicks = Math.floor((Number(currentTimeSeconds) || 0) * JELLYFIN_TICKS_PER_SECOND);
	const lastStartedIndex = findLastStartedCueIndex(events, currentTicks);
	const cues = [];
	for (let index = lastStartedIndex; index >= 0; index -= 1) {
		const event = events[index];
		if (event.endTicks >= currentTicks) {
			cues.push(decorateActiveAssCue(event, currentTicks));
		}
	}
	cues.sort(compareActiveSubtitleRenderOrder);
	return {
		cues,
		activeCount: cues.length
	};
};

export const findActiveSubtitleText = (events = [], currentTimeSeconds = 0) => {
	const active = findActiveSubtitleCues(events, currentTimeSeconds);
	return {
		text: active.cues.map((cue) => cue.lines.join('\n')).join('\n'),
		activeCount: active.activeCount
	};
};
