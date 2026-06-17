import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';

const ALLOWED_SUBTITLE_TAGS = new Set(['BR', 'B', 'STRONG', 'I', 'EM', 'U']);
const BLOCKED_SUBTITLE_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);
const ASS_OVERRIDE_BLOCK_PATTERN = /\{\\[^}]*\}/g;
const ASS_ALIGNMENT_PATTERN = /\\an([1-9])/i;
const ASS_LINE_BREAK_PATTERN = /\\[Nn]/g;
const SUBTITLE_PLACEMENT_TOP = 'top';
const SUBTITLE_PLACEMENT_MIDDLE = 'middle';
const SUBTITLE_PLACEMENT_BOTTOM = 'bottom';
const SUBTITLE_ALIGN_LEFT = 'left';
const SUBTITLE_ALIGN_CENTER = 'center';
const SUBTITLE_ALIGN_RIGHT = 'right';

const escapeHtml = (value) => String(value || '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const unwrapNode = (node) => {
	const parent = node.parentNode;
	if (!parent) return;
	while (node.firstChild) {
		parent.insertBefore(node.firstChild, node);
	}
	parent.removeChild(node);
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
		Array.from(child.attributes || []).forEach((attribute) => {
			child.removeAttribute(attribute.name);
		});
		sanitizeNode(child);
	});
};

export const sanitizeSubtitleHtml = (value) => {
	const raw = String(value || '');
	if (!raw) return '';
	if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.Node === 'undefined') {
		return escapeHtml(raw).replace(/\n/g, '<br />');
	}
	const template = document.createElement('template');
	template.innerHTML = raw.replace(/\n/g, '<br />');
	sanitizeNode(template.content);
	return template.innerHTML;
};

const getPlacementFromAssAlignment = (alignment) => {
	const numberValue = Number(alignment);
	if (!Number.isInteger(numberValue)) return null;
	if (numberValue >= 7 && numberValue <= 9) return SUBTITLE_PLACEMENT_TOP;
	if (numberValue >= 4 && numberValue <= 6) return SUBTITLE_PLACEMENT_MIDDLE;
	if (numberValue >= 1 && numberValue <= 3) return SUBTITLE_PLACEMENT_BOTTOM;
	return null;
};

const getHorizontalAlignFromAssAlignment = (alignment) => {
	const numberValue = Number(alignment);
	if (!Number.isInteger(numberValue)) return null;
	if (numberValue === 1 || numberValue === 4 || numberValue === 7) return SUBTITLE_ALIGN_LEFT;
	if (numberValue === 3 || numberValue === 6 || numberValue === 9) return SUBTITLE_ALIGN_RIGHT;
	if (numberValue >= 1 && numberValue <= 9) return SUBTITLE_ALIGN_CENTER;
	return null;
};

const getPlacementFromAlignment = (value) => {
	const normalized = String(value || '').trim().toLowerCase();
	if (!normalized) return null;
	if (normalized.includes('top')) return SUBTITLE_PLACEMENT_TOP;
	if (normalized.includes('middle')) return SUBTITLE_PLACEMENT_MIDDLE;
	if (normalized.includes('bottom')) return SUBTITLE_PLACEMENT_BOTTOM;
	return null;
};

const getHorizontalAlignFromAlignment = (value) => {
	const normalized = String(value || '').trim().toLowerCase();
	if (!normalized) return null;
	if (normalized.includes('left')) return SUBTITLE_ALIGN_LEFT;
	if (normalized.includes('right')) return SUBTITLE_ALIGN_RIGHT;
	if (normalized.includes('center') || normalized.includes('middle')) return SUBTITLE_ALIGN_CENTER;
	return null;
};

const getPlacementFromPosition = (value) => {
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

export const parseSubtitleCueText = (value) => {
	const raw = String(value || '');
	let assAlignment = null;
	let hasAssOverrides = false;
	const text = raw
		.replace(ASS_OVERRIDE_BLOCK_PATTERN, (block) => {
			hasAssOverrides = true;
			const alignmentMatch = block.match(ASS_ALIGNMENT_PATTERN);
			if (alignmentMatch) {
				assAlignment = alignmentMatch[1];
			}
			return buildAssInlineFormattingReplacement(block);
		})
		.replace(ASS_LINE_BREAK_PATTERN, '\n');
	return {
		text,
		assPlacement: getPlacementFromAssAlignment(assAlignment),
		assAlignment: getHorizontalAlignFromAssAlignment(assAlignment),
		hasAssOverrides
	};
};

const buildCueLines = (value) => {
	const parsed = parseSubtitleCueText(value);
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
			const parsedText = parseSubtitleCueText(event?.Text);
			const lines = buildCueLines(event?.Text);
			const position = normalizeCuePosition(event?.Position);
			const alignment = event?.Alignment || null;
			return {
				startTicks: Number(event?.StartPositionTicks),
				endTicks: Number(event?.EndPositionTicks),
				lines,
				format: event?.Format || 'jellyfin-track-event',
				position,
				alignment,
				placement:
					parsedText.assPlacement ||
					getPlacementFromAlignment(alignment) ||
					getPlacementFromPosition(position) ||
					SUBTITLE_PLACEMENT_BOTTOM,
				horizontalAlign:
					parsedText.assAlignment ||
					getHorizontalAlignFromAlignment(alignment) ||
					SUBTITLE_ALIGN_CENTER,
				hasAssOverrides: parsedText.hasAssOverrides
			};
		})
		.filter((event) => (
			Number.isFinite(event.startTicks) &&
			Number.isFinite(event.endTicks) &&
			event.endTicks >= event.startTicks &&
			event.lines.length > 0
		))
		.sort((left, right) => left.startTicks - right.startTicks || left.endTicks - right.endTicks);
};

const findFirstPotentialCueIndex = (events, currentTicks) => {
	let low = 0;
	let high = events.length - 1;
	let result = events.length;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (events[middle].endTicks >= currentTicks) {
			result = middle;
			high = middle - 1;
		} else {
			low = middle + 1;
		}
	}
	return result;
};

export const findActiveSubtitleCues = (events = [], currentTimeSeconds = 0) => {
	if (!Array.isArray(events) || events.length === 0) {
		return {
			cues: [],
			activeCount: 0
		};
	}
	const currentTicks = Math.floor((Number(currentTimeSeconds) || 0) * JELLYFIN_TICKS_PER_SECOND);
	const startIndex = findFirstPotentialCueIndex(events, currentTicks);
	const cues = [];
	for (let index = startIndex; index < events.length; index += 1) {
		const event = events[index];
		if (event.startTicks > currentTicks) break;
		if (event.endTicks >= currentTicks) {
			cues.push(event);
		}
	}
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
